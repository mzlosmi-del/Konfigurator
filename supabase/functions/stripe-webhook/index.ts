import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

// No CORS headers — this endpoint is called by Stripe, not the browser.

const PLAN_FROM_PRICE: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_STARTER_MONTHLY') ?? '']: 'starter',
  [Deno.env.get('STRIPE_PRICE_STARTER_ANNUAL')  ?? '']: 'starter',
  [Deno.env.get('STRIPE_PRICE_GROWTH_MONTHLY')  ?? '']: 'growth',
  [Deno.env.get('STRIPE_PRICE_GROWTH_ANNUAL')   ?? '']: 'growth',
  [Deno.env.get('STRIPE_PRICE_SCALE_MONTHLY')   ?? '']: 'scale',
  [Deno.env.get('STRIPE_PRICE_SCALE_ANNUAL')    ?? '']: 'scale',
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
  const sig    = req.headers.get('Stripe-Signature') ?? ''
  const body   = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Idempotency — skip if already processed
  const { error: dupErr } = await supabase
    .from('processed_events')
    .insert({ stripe_event_id: event.id })
  if (dupErr) {
    // Duplicate key = already processed
    return new Response('OK', { status: 200 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const tenantId = session.metadata?.tenant_id
        if (!tenantId) break
        const subId = session.subscription as string
        const sub   = await stripe.subscriptions.retrieve(subId)
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan  = PLAN_FROM_PRICE[priceId] ?? 'free'
        await supabase.from('tenants').update({
          plan,
          stripe_subscription_id: subId,
          subscription_status:    sub.status,
          grace_period_ends_at:   null,
        } as never).eq('id', tenantId)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        if (!tenantId) break
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan    = PLAN_FROM_PRICE[priceId] ?? 'free'
        await supabase.from('tenants').update({
          plan,
          subscription_status:  sub.status,
          grace_period_ends_at: null,
        } as never).eq('id', tenantId)
        // Re-evaluate over-limit resources when downgrading
        await supabase.rpc('mark_over_limit_products', { p_tenant_id: tenantId })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        if (!tenantId) break
        await supabase.from('tenants').update({
          plan:                   'free',
          stripe_subscription_id: null,
          subscription_status:    'canceled',
          grace_period_ends_at:   null,
        } as never).eq('id', tenantId)
        await supabase.rpc('mark_over_limit_products', { p_tenant_id: tenantId })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const sub     = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription as string)
          : null
        const tenantId = sub?.metadata?.tenant_id
        if (!tenantId) break
        // Grace period: 7 days from first failure
        const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await supabase.from('tenants').update({
          subscription_status:  'past_due',
          grace_period_ends_at: gracePeriodEndsAt,
        } as never).eq('id', tenantId)
        // TODO: send grace-period warning email via Resend (day 0 email)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response('Handler error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})
