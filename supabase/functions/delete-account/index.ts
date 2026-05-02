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

  // Verify caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }
  const token = authHeader.slice(7)

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  try {
    // 1. Get user's tenant_id
    const { data: profile, error: profileErr } = await sb
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return new Response('Profile not found', { status: 404, headers: CORS })
    }

    const tenantId = (profile as { tenant_id: string }).tenant_id

    // 2. Delete tenant — cascades to all products, characteristics, inquiries,
    //    quotations, visualization_assets, rules, formulas, texts, invitations, webhooks
    const { error: tenantErr } = await sb
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (tenantErr) {
      console.error('delete-account: tenant delete failed', tenantErr)
      return new Response('Failed to delete workspace data', { status: 500, headers: CORS })
    }

    // 3. Delete auth user — cascades to profiles row
    const { error: userErr } = await sb.auth.admin.deleteUser(user.id)
    if (userErr) {
      console.error('delete-account: auth user delete failed', userErr)
      return new Response('Failed to delete user', { status: 500, headers: CORS })
    }

    console.log(`delete-account: deleted tenant ${tenantId} and user ${user.id}`)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('delete-account: unexpected error', err)
    return new Response('Internal error', { status: 500, headers: CORS })
  }
})
