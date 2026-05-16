// Edge Function: verify-email-domain
//
// Lets a Scale-tier tenant register a custom email-sending domain with
// Resend and check verification status. Stores the resend_domain_id on
// the tenants row and flips email_from_verified=true once Resend reports
// the domain is verified.
//
// All requests are POST with a JSON body { action, ... }:
//   { action: 'register', domain: 'acme.com' } → register, returns DNS records
//   { action: 'status' }                       → poll Resend, update flag
//   { action: 'remove' }                       → unregister, clear address + flag
//
// We resolve the caller's tenant from their JWT (admin-only). The plan
// feature check uses the tenant_has_feature SQL function directly so the
// function bundle has no sibling _shared/ dependency (dashboard deploys
// don't pull adjacent folders).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ResendDomainRecord {
  record:    string
  name:      string
  type:      string
  ttl:       string
  status:    string
  value:     string
  priority?: number
}

interface ResendDomain {
  id:       string
  name:     string
  status:   string
  records?: ResendDomainRecord[]
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey   = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const sb = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile } = await sb
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()
    if (!profile) return json({ error: 'Profile not found' }, 404)
    if ((profile as { role: string }).role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }
    const tenantId = (profile as { tenant_id: string }).tenant_id

    // ── Plan gate (white_label feature) ───────────────────────────────────────
    // Resolve plan + feature flag via the SQL helper. Mirrors the shape that
    // _shared/planGate.ts produces for consistent client-side parsing.
    const { data: tenantRow } = await sb
      .from('tenants').select('plan').eq('id', tenantId).single()
    const plan = (tenantRow as { plan: string } | null)?.plan ?? 'free'
    const { data: hasFeature } = await sb.rpc('tenant_has_feature', {
      p_tenant_id: tenantId,
      p_feature:   'white_label',
    })
    if (hasFeature !== true) {
      return json({
        code:       'PLAN_LIMIT_EXCEEDED',
        dimension:  'white_label',
        plan,
        upgrade_to: 'scale',
      }, 403)
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────
    let body: { action?: string; domain?: string }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Bad request' }, 400)
    }

    switch (body.action) {
      case 'register': return handleRegister(body.domain ?? '', sb, tenantId, resendApiKey)
      case 'status':   return handleStatus(sb, tenantId, resendApiKey)
      case 'remove':   return handleRemove(sb, tenantId, resendApiKey)
      default:         return json({ error: 'Unknown action' }, 400)
    }

  } catch (err) {
    console.error(JSON.stringify({
      severity: 'error',
      function: 'verify-email-domain',
      error:    err instanceof Error ? err.message : String(err),
      stack:    err instanceof Error ? err.stack   : undefined,
    }))
    throw err
  }
})

async function handleRegister(
  domain: string,
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  resendApiKey: string,
): Promise<Response> {
  const d = domain.trim().toLowerCase()
  if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
    return json({ error: 'Invalid domain' }, 400)
  }

  // If a previous domain exists, remove it first (best-effort cleanup).
  const { data: existing } = await sb
    .from('tenants')
    .select('resend_domain_id')
    .eq('id', tenantId)
    .single()
  const prevId = (existing as { resend_domain_id: string | null } | null)?.resend_domain_id ?? null
  if (prevId) {
    await fetch(`https://api.resend.com/domains/${prevId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${resendApiKey}` },
    }).catch(() => { /* swallow */ })
  }

  const res = await fetch('https://api.resend.com/domains', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ name: d }),
  })
  if (!res.ok) {
    const text = await res.text()
    return json({ error: 'Resend create failed', detail: text }, 502)
  }
  const created = await res.json() as ResendDomain

  await sb.from('tenants').update({
    resend_domain_id:    created.id,
    email_from_verified: false,
  } as never).eq('id', tenantId)

  return json({
    domain_id: created.id,
    domain:    created.name,
    status:    created.status,
    records:   created.records ?? [],
  })
}

async function handleStatus(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  resendApiKey: string,
): Promise<Response> {
  const { data: tenant } = await sb
    .from('tenants')
    .select('resend_domain_id')
    .eq('id', tenantId)
    .single()
  const domainId = (tenant as { resend_domain_id: string | null } | null)?.resend_domain_id
  if (!domainId) return json({ error: 'No domain registered' }, 404)

  const res = await fetch(`https://api.resend.com/domains/${domainId}`, {
    headers: { 'Authorization': `Bearer ${resendApiKey}` },
  })
  if (!res.ok) return json({ error: 'Resend status failed' }, 502)
  const detail = await res.json() as ResendDomain

  const verified = detail.status === 'verified'
  await sb.from('tenants').update({
    email_from_verified: verified,
  } as never).eq('id', tenantId)

  return json({
    domain:   detail.name,
    status:   detail.status,
    verified,
    records:  detail.records ?? [],
  })
}

async function handleRemove(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  resendApiKey: string,
): Promise<Response> {
  const { data: tenant } = await sb
    .from('tenants')
    .select('resend_domain_id')
    .eq('id', tenantId)
    .single()
  const domainId = (tenant as { resend_domain_id: string | null } | null)?.resend_domain_id
  if (domainId) {
    await fetch(`https://api.resend.com/domains/${domainId}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${resendApiKey}` },
    }).catch(() => { /* best effort */ })
  }
  await sb.from('tenants').update({
    resend_domain_id:    null,
    email_from_address:  null,
    email_from_verified: false,
  } as never).eq('id', tenantId)
  return json({ ok: true })
}
