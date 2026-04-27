import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('id', user.id).single()
  if (!profile) return new Response('Profile not found', { status: 404, headers: CORS })

  const { data: tenant } = await supabase
    .from('tenants').select('stripe_customer_id').eq('id', profile.tenant_id).single()

  if (!tenant?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No active subscription found' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const stripe  = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   tenant.stripe_customer_id,
    return_url: `${siteUrl}/settings`,
  })

  return new Response(JSON.stringify({ url: portalSession.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
