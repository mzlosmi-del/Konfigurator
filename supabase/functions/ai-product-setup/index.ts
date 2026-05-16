import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Inlined plan-gate + monthly-usage helpers ──────────────────────────────
// (Originally in supabase/functions/_shared/. Inlined so this function can be
// pasted directly into the Supabase dashboard without external file deps.)

interface PlanLimits {
  plan:                string
  products_max:        number
  inquiries_per_month: number
  team_members_max:    number
  three_d:             boolean
  quotations:          boolean
  webhooks:            boolean
  remove_branding:     boolean
  white_label:         boolean
  ai_setup_per_month:  number
  analytics:           string
}

interface PlanLimitError {
  code:       'PLAN_LIMIT_EXCEEDED'
  dimension:  string
  current?:   number
  limit?:     number
  plan:       string
  upgrade_to: string
}

const NEXT_PLAN: Record<string, string> = {
  free: 'starter', starter: 'growth', growth: 'scale', scale: 'scale',
}

function makePlanError(
  dimension: string,
  plan: string,
  current?: number,
  limit?: number,
): PlanLimitError {
  return {
    code: 'PLAN_LIMIT_EXCEEDED',
    dimension,
    ...(current !== undefined && { current }),
    ...(limit   !== undefined && { limit }),
    plan,
    upgrade_to: NEXT_PLAN[plan] ?? 'scale',
  }
}

async function loadPlanLimits(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<PlanLimits | null> {
  const { data } = await sb
    .from('tenants')
    .select('plan, plan_limits!inner(*)')
    .eq('id', tenantId)
    .single()
  if (!data) return null
  const row = (data as Record<string, unknown>)
  const limits = (row.plan_limits as PlanLimits[] | PlanLimits | null)
  if (!limits) return null
  return Array.isArray(limits) ? limits[0] : limits
}

function gateForbidden(err: PlanLimitError, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(err), {
    status:  403,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function assertMonthlyLimit(
  dimension: 'ai_setup' | 'inquiries',
  limitValue: number,
  current: number,
  plan: string,
  cors: Record<string, string> = {},
): Response | null {
  if (limitValue < 0) return null
  if (current >= limitValue) {
    return gateForbidden(makePlanError(dimension, plan, current, limitValue), cors)
  }
  return null
}

function currentPeriodMonth(): string {
  const d = new Date()
  d.setUTCDate(1)
  return d.toISOString().slice(0, 10)
}

async function getMonthlyUsage(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  dimension: 'inquiries' | 'ai_setup',
): Promise<number> {
  const column = dimension === 'inquiries' ? 'inquiries_count' : 'ai_setup_count'
  const { data } = await sb
    .from('monthly_usage')
    .select(column)
    .eq('tenant_id', tenantId)
    .eq('period_month', currentPeriodMonth())
    .maybeSingle()
  if (!data) return 0
  return ((data as Record<string, number>)[column] ?? 0)
}

async function incrementMonthlyUsage(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  dimension: 'inquiries' | 'ai_setup',
): Promise<void> {
  const period = currentPeriodMonth()
  const current = await getMonthlyUsage(sb, tenantId, dimension)
  const row: Record<string, unknown> = {
    tenant_id:    tenantId,
    period_month: period,
    inquiries_count: dimension === 'inquiries' ? current + 1 : 0,
    ai_setup_count:  dimension === 'ai_setup'  ? current + 1 : 0,
  }
  if (current > 0 || dimension === 'ai_setup') {
    const { data: existing } = await sb
      .from('monthly_usage')
      .select('inquiries_count, ai_setup_count')
      .eq('tenant_id', tenantId)
      .eq('period_month', period)
      .maybeSingle()
    if (existing) {
      const ex = existing as { inquiries_count: number; ai_setup_count: number }
      row.inquiries_count = dimension === 'inquiries' ? ex.inquiries_count + 1 : ex.inquiries_count
      row.ai_setup_count  = dimension === 'ai_setup'  ? ex.ai_setup_count  + 1 : ex.ai_setup_count
    }
  }
  await sb.from('monthly_usage').upsert(row as never, { onConflict: 'tenant_id,period_month' })
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
  try {
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

    // Plan gating — uses the shared loadPlanLimits + assertMonthlyLimit pair so
    // every gated function speaks the same structured error shape.
    const limits = await loadPlanLimits(supabase, tenantId)
    if (!limits) return new Response('Tenant not found', { status: 404, headers: CORS })
    if (limits.ai_setup_per_month === 0) {
      return gateForbidden(makePlanError('ai_setup', limits.plan, 0, 0), CORS)
    }
    const used = await getMonthlyUsage(supabase, tenantId, 'ai_setup')
    const monthlyGate = assertMonthlyLimit('ai_setup', limits.ai_setup_per_month, used, limits.plan, CORS)
    if (monthlyGate) return monthlyGate

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

    await incrementMonthlyUsage(supabase, tenantId, 'ai_setup')

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(JSON.stringify({
      severity: 'error',
      function: 'ai-product-setup',
      error:    err instanceof Error ? err.message : String(err),
      stack:    err instanceof Error ? err.stack   : undefined,
    }))
    throw err
  }
})
