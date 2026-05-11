// Edge Function: quotation-respond
//
// Public endpoint (no auth) that accepts the customer's Accept / Reject
// click on /q/:token. Body: { token: string, action: 'accept' | 'reject' }.
//
// Validates the token, the quotation's current status (must be
// 'sent'), and its valid_until window. Then atomically flips the
// status to accepted_no_changes / rejected — the WHERE status = 'sent'
// guard makes the update idempotent against duplicate clicks.
//
// Self-contained — no _shared/ imports — so it bundles cleanly when
// deployed via the Supabase dashboard editor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, serviceRoleKey)

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { token?: string; action?: string }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  const token  = String(body?.token  ?? '').trim()
  const action = String(body?.action ?? '').trim()

  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Invalid token' }, 400)
  if (action !== 'accept' && action !== 'reject') {
    return json({ error: 'Invalid action' }, 400)
  }

  // ── Load quotation by token ───────────────────────────────────────────────
  const { data: quotation } = await sb
    .from('quotations')
    .select('id, tenant_id, reference_number, customer_name, status, valid_until, responded_at')
    .eq('public_token', token)
    .maybeSingle()
  if (!quotation) return json({ error: 'Not found' }, 404)

  // ── Expiry / status checks ────────────────────────────────────────────────
  if (quotation.valid_until && new Date(quotation.valid_until) < new Date()) {
    return json({
      error:       'Quotation expired',
      status:      quotation.status,
      valid_until: quotation.valid_until,
    }, 410)
  }
  if (quotation.status !== 'sent') {
    return json({
      error:        'Already responded',
      status:       quotation.status,
      responded_at: quotation.responded_at,
    }, 409)
  }

  // ── Capture audit fields ──────────────────────────────────────────────────
  const ip = req.headers.get('cf-connecting-ip')
          ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? null
  const ua = req.headers.get('user-agent') ?? null
  const newStatus = action === 'accept' ? 'accepted_no_changes' : 'rejected'

  // ── Atomic update with idempotency guard ──────────────────────────────────
  const { data: updated, error: updErr } = await sb
    .from('quotations')
    .update({
      status:               newStatus,
      responded_at:         new Date().toISOString(),
      responded_ip:         ip,
      responded_user_agent: ua,
    } as never)
    .eq('id', quotation.id)
    .eq('status', 'sent')   // race guard
    .select('id, status, responded_at')
    .single()

  if (updErr || !updated) {
    // Race lost — re-fetch and report current state.
    const { data: latest } = await sb
      .from('quotations').select('status, responded_at')
      .eq('id', quotation.id).single()
    return json({
      error:        'Already responded',
      status:       (latest as { status: string } | null)?.status ?? quotation.status,
      responded_at: (latest as { responded_at: string | null } | null)?.responded_at ?? null,
    }, 409)
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  // Service-role writes bypass RLS. Mirrors the shape that auditLog.logChange
  // produces in the admin client.
  await sb.from('audit_log').insert({
    tenant_id:       quotation.tenant_id,
    entity_type:     'quotation',
    entity_id:       quotation.id,
    entity_name:     quotation.reference_number,
    change_type:     'update',
    changed_by:      null,
    changed_by_name: `${quotation.customer_name} (customer)`,
    diff:            { Status: { old: 'sent', new: newStatus } },
  } as never)

  return json({
    ok:           true,
    status:       newStatus,
    responded_at: updated.responded_at,
  })
})
