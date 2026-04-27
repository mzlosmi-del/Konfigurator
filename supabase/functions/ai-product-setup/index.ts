import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a product configurator assistant. Given a product description and optional vertical, output a JSON configuration for a configurable product.

Output ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "name": "<short product name>",
  "description": "<1-2 sentence marketing description>",
  "base_price": <number>,
  "currency": "EUR"|"USD"|"GBP",
  "characteristics": [
    {
      "name": "<e.g. Material, Size, Color>",
      "display_type": "select"|"radio"|"swatch",
      "is_required": true|false,
      "values": [
        { "label": "<e.g. Oak, 120 cm>", "price_modifier": <number> }
      ]
    }
  ]
}

Rules:
- 2–5 characteristics, 2–8 values each
- price_modifier is a non-negative number (0 = no change, positive = add-on)
- use "swatch" only for color/finish/material options with colour names
- currency defaults to EUR
- base_price is the starting price before modifiers; 0 if unknown`

// ── Types ──────────────────────────────────────────────────────────────────

interface CharValue  { label: string; price_modifier: number }
interface AiChar     { name: string; display_type: string; is_required: boolean; values: CharValue[] }
interface AiProduct  { name: string; description: string; base_price: number; currency: string; characteristics: AiChar[] }

function validate(obj: unknown): obj is AiProduct {
  if (typeof obj !== 'object' || obj === null) return false
  const p = obj as Record<string, unknown>
  if (typeof p.name !== 'string' || !p.name) return false
  if (typeof p.description !== 'string') return false
  if (typeof p.base_price !== 'number') return false
  if (!['EUR', 'USD', 'GBP'].includes(p.currency as string)) return false
  if (!Array.isArray(p.characteristics) || p.characteristics.length === 0) return false
  for (const c of p.characteristics as unknown[]) {
    if (typeof c !== 'object' || c === null) return false
    const ch = c as Record<string, unknown>
    if (typeof ch.name !== 'string' || !ch.name) return false
    if (!['select', 'radio', 'swatch'].includes(ch.display_type as string)) return false
    if (typeof ch.is_required !== 'boolean') return false
    if (!Array.isArray(ch.values) || ch.values.length === 0) return false
    for (const v of ch.values as unknown[]) {
      if (typeof v !== 'object' || v === null) return false
      const val = v as Record<string, unknown>
      if (typeof val.label !== 'string' || !val.label) return false
      if (typeof val.price_modifier !== 'number') return false
    }
  }
  return true
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('id', user.id).single()
  if (!profile) return new Response('Profile not found', { status: 404, headers: CORS })
  const tenantId = profile.tenant_id as string

  // Plan gating
  const { data: tenant } = await supabase
    .from('tenants').select('plan').eq('id', tenantId).single()
  const { data: limits } = await supabase
    .from('plan_limits').select('ai_setup_per_month').eq('plan', tenant?.plan ?? 'free').single()
  const maxSetups = (limits?.ai_setup_per_month as number) ?? 0

  if (maxSetups === 0) {
    return new Response(JSON.stringify({ error: 'plan_limit_exceeded: AI setup not available on your plan' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (maxSetups > 0) {
    const periodMonth = new Date()
    periodMonth.setDate(1)
    const monthStr = periodMonth.toISOString().slice(0, 10)

    const { data: usage } = await supabase
      .from('monthly_usage')
      .select('ai_setup_count')
      .eq('tenant_id', tenantId)
      .eq('period_month', monthStr)
      .single()

    const used = (usage?.ai_setup_count as number) ?? 0
    if (used >= maxSetups) {
      return new Response(JSON.stringify({ error: 'plan_limit_exceeded: monthly AI setup limit reached' }), {
        status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  // Parse body
  let description: string, vertical: string | undefined
  try {
    const body = await req.json() as { description?: unknown; vertical?: unknown }
    description = (typeof body.description === 'string' ? body.description : '').trim()
    vertical    = typeof body.vertical === 'string' ? body.vertical.trim() : undefined
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }

  if (!description) {
    return new Response(JSON.stringify({ error: 'description required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const userMessage = vertical
    ? `Vertical: ${vertical}\n\nDescription: ${description}`
    : `Description: ${description}`

  // Call Claude — retry once on validation failure
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  async function callClaude(messages: Anthropic.MessageParam[]): Promise<string> {
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages,
    })
    return (msg.content[0] as { type: string; text: string }).text ?? ''
  }

  let result: AiProduct | null = null
  let raw = ''

  try {
    raw = await callClaude([{ role: 'user', content: userMessage }])
    const parsed = JSON.parse(raw)
    if (validate(parsed)) {
      result = parsed
    } else {
      // Retry with validation errors
      raw = await callClaude([
        { role: 'user', content: userMessage },
        { role: 'assistant', content: raw },
        { role: 'user', content: 'The JSON you returned failed schema validation. Fix it and return valid JSON only.' },
      ])
      const parsed2 = JSON.parse(raw)
      if (validate(parsed2)) result = parsed2
    }
  } catch (e) {
    console.error('ai-product-setup Claude error:', e)
  }

  if (!result) {
    return new Response(JSON.stringify({ error: 'Failed to generate valid product config' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Increment ai_setup_count in monthly_usage (read-then-write; low-concurrency path)
  const periodMonth = new Date()
  periodMonth.setDate(1)
  const monthStr = periodMonth.toISOString().slice(0, 10)

  const { data: existingUsage } = await supabase
    .from('monthly_usage')
    .select('ai_setup_count')
    .eq('tenant_id', tenantId)
    .eq('period_month', monthStr)
    .maybeSingle()

  if (existingUsage) {
    await supabase
      .from('monthly_usage')
      .update({ ai_setup_count: (existingUsage.ai_setup_count as number) + 1 } as unknown as never)
      .eq('tenant_id', tenantId)
      .eq('period_month', monthStr)
  } else {
    await supabase
      .from('monthly_usage')
      .insert({ tenant_id: tenantId, period_month: monthStr, ai_setup_count: 1, inquiries_count: 0 } as unknown as never)
  }

  return new Response(JSON.stringify(result), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
