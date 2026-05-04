import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // Require a valid JWT so we know which user is accepting
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }
  const accessToken = authHeader.slice(7)

  let body: { token: string }
  try {
    body = await req.json()
    if (!body.token) throw new Error('missing token')
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // Verify the JWT and get the caller's identity
  const { data: { user }, error: authErr } = await sb.auth.getUser(accessToken)
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  // Look up the invite
  const { data: invite, error: inviteErr } = await sb
    .from('invitations')
    .select('id, tenant_id, email, role, accepted_at, expires_at')
    .eq('token', body.token)
    .maybeSingle()

  if (inviteErr) {
    console.error('accept-invite: lookup failed', inviteErr)
    return new Response('Server error', { status: 500, headers: CORS })
  }

  if (!invite) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (invite.accepted_at) {
    return new Response(JSON.stringify({ error: 'already_accepted' }), {
      status: 409, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'expired' }), {
      status: 410, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Security: invite email must match the authenticated user's email
  if (invite.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return new Response(JSON.stringify({ error: 'email_mismatch' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Upsert profile: assign to invited tenant + role, overriding any prior state
  const { error: upsertErr } = await sb
    .from('profiles')
    .upsert({
      id:        user.id,
      tenant_id: invite.tenant_id,
      role:      invite.role,
      email:     user.email,
    }, { onConflict: 'id' })

  if (upsertErr) {
    console.error('accept-invite: profile upsert failed', upsertErr)
    return new Response('Server error', { status: 500, headers: CORS })
  }

  // Mark invitation as accepted
  await sb
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
