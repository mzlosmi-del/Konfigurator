import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stripe price IDs must be set as Edge Function secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_ANNUAL
//   STRIPE_PRICE_GROWTH_MONTHLY,  STRIPE_PRICE_GROWTH_ANNUAL
//   STRIPE_PRICE_SCALE_MONTHLY,   STRIPE_PRICE_SCALE_ANNUAL
//   SITE_URL

const PRICE_MAP: Record<string, Record<string, string>> = {
  starter: {
    monthly: Deno.env.get('STRIPE_PRICE_STARTER_MONTHLY') ?? '',
    annual:  Deno.env.get('STRIPE_PRICE_STARTER_ANNUAL')  ?? '',
  },
  growth: {
    monthly: Deno.env.get('STRIPE_PRICE_GROWTH_MONTHLY') ?? '',
    annual:  Deno.env.get('STRIPE_PRICE_GROWTH_ANNUAL')  ?? '',
  },
  scale: {
    monthly: Deno.env.get('STRIPE_PRICE_SCALE_MONTHLY') ?? '',
    annual:  Deno.env.get('STRIPE_PRICE_SCALE_ANNUAL')  ?? '',
  },
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
    .from('tenants').select('*').eq('id', profile.tenant_id).single()
  if (!tenant) return new Response('Tenant not found', { status: 404, headers: CORS })

  const body = await req.json() as { plan: string; interval: 'monthly' | 'annual' }
  const priceId = PRICE_MAP[body.plan]?.[body.interval]
  if (!priceId) {
    return new Response(JSON.stringify({ error: 'Invalid plan or interval' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000'

  // Reuse or create Stripe customer
  let customerId: string = tenant.stripe_customer_id ?? ''
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { tenant_id: tenant.id },
    })
    customerId = customer.id
    await supabase.from('tenants')
      .update({ stripe_customer_id: customerId } as never)
      .eq('id', tenant.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/settings?billing=success`,
    cancel_url:  `${siteUrl}/settings?billing=cancel`,
    metadata: { tenant_id: tenant.id, plan: body.plan },
    subscription_data: { metadata: { tenant_id: tenant.id, plan: body.plan } },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
