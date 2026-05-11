import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Inlined plan-gate + email-sender helpers ───────────────────────────────
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

const DEFAULT_FROM = 'notifications@konfigurator.app'

async function getFromAddress(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<string> {
  const fallback = Deno.env.get('NOTIFY_FROM_EMAIL') ?? DEFAULT_FROM
  const [{ data: tenant }, { data: hasFeature }] = await Promise.all([
    sb.from('tenants')
      .select('email_from_address, email_from_verified')
      .eq('id', tenantId)
      .maybeSingle(),
    sb.rpc('tenant_has_feature', { p_tenant_id: tenantId, p_feature: 'white_label' }),
  ])
  if (hasFeature !== true) return fallback
  const t = tenant as { email_from_address: string | null; email_from_verified: boolean } | null
  if (!t?.email_from_address || !t.email_from_verified) return fallback
  return t.email_from_address
}

interface InviteBody {
  email: string
  role: 'admin' | 'member' | 'viewer'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey   = Deno.env.get('RESEND_API_KEY')!
  const siteUrl        = Deno.env.get('SITE_URL') ?? 'https://app.konfigurator.app'

  // Verify caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }
  const token = authHeader.slice(7)

  let body: InviteBody
  try {
    body = await req.json()
    if (!body.email || !body.role) throw new Error('missing fields')
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }

  // Resend rejects non-ASCII email addresses
  if (!/^[\x00-\x7F]+$/.test(body.email)) {
    return new Response(
      JSON.stringify({ error: 'invalid_email', message: 'Email address must contain only standard ASCII characters.' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  // Get caller's tenant + profile
  const { data: callerProfile } = await sb
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return new Response('Forbidden — only admins can invite', { status: 403, headers: CORS })
  }

  const tenantId = callerProfile.tenant_id

  // ── Plan gate: team_members_max ────────────────────────────────────────
  const limits = await loadPlanLimits(sb, tenantId)
  if (limits && limits.team_members_max >= 0) {
    const { count } = await sb
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    if ((count ?? 0) >= limits.team_members_max) {
      return gateForbidden(
        makePlanError('team_members', limits.plan, count ?? 0, limits.team_members_max),
        CORS,
      )
    }
  }

  // Check if email already a member
  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', body.email)
    .maybeSingle()

  if (existing) {
    return new Response(JSON.stringify({ error: 'already_member' }), {
      status: 409, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Get tenant name for email
  const { data: tenant } = await sb
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const tenantName = (tenant as { name: string } | null)?.name ?? 'your workspace'

  // Get inviter's name/email
  const { data: inviterUser } = await sb.auth.admin.getUserById(user.id)
  const inviterEmail = inviterUser?.user?.email ?? 'a team member'

  // Create invite record
  const { data: invite, error: inviteErr } = await sb
    .from('invitations')
    .insert({
      tenant_id:  tenantId,
      email:      body.email,
      role:       body.role,
      invited_by: callerProfile.id,
    })
    .select('token')
    .single()

  if (inviteErr || !invite) {
    console.error('send-invite: insert failed', inviteErr)
    return new Response('Failed to create invitation', { status: 500, headers: CORS })
  }

  const inviteUrl = `${siteUrl}/invite/${invite.token}`

  // Send invite email
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
      <h1 style="margin:0;font-size:18px;font-weight:600;color:#111;">You've been invited</h1>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        <strong>${escHtml(inviterEmail)}</strong> has invited you to join
        <strong>${escHtml(tenantName)}</strong> on Konfigurator as <strong>${escHtml(body.role)}</strong>.
      </p>
      <a href="${inviteUrl}"
        style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;
               text-decoration:none;font-size:14px;font-weight:500;">
        Accept invitation
      </a>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
        This link expires in 7 days. If you didn't expect this invitation, you can ignore it.
      </p>
    </div>
  </div>
</body>
</html>`

  let emailSent = false
  if (!resendApiKey) {
    console.warn(`send-invite: RESEND_API_KEY not set — invite URL: ${inviteUrl}`)
  } else {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    await getFromAddress(sb, tenantId),
        to:      [body.email],
        subject: `You've been invited to ${tenantName} on Konfigurator`,
        html,
      }),
    })
    if (emailRes.ok) {
      emailSent = true
    } else {
      console.error('send-invite: Resend failed', emailRes.status, await emailRes.text())
    }
  }

  return new Response(JSON.stringify({ ok: true, emailSent, inviteUrl }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
