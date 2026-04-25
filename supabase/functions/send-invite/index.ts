import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
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
  const fromEmail      = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'notifications@konfigurator.app'
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

  if (resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [body.email],
        subject: `You've been invited to ${tenantName} on Konfigurator`,
        html,
      }),
    })
    if (!res.ok) {
      console.warn('send-invite: Resend failed', res.status, await res.text())
    }
  } else {
    console.log(`send-invite: RESEND_API_KEY not set — invite URL: ${inviteUrl}`)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
