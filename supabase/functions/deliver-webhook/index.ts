import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Deliver a webhook event to all enabled tenant endpoints subscribed to it.
 * Called explicitly by other edge functions (notify-inquiry, etc.) after the
 * primary action succeeds — not a DB trigger.
 *
 * Body: { event: string, tenant_id: string, payload: object }
 *
 * For inquiry.created events the outgoing payload is enriched with v2 flat
 * Zapier-friendly fields while keeping all v1 fields unchanged.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeliverBody {
  event:     string
  tenant_id: string
  payload:   Record<string, unknown>
}

interface EndpointRow {
  id:     string
  url:    string
  secret: string
  events: string[]
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const enc   = new TextEncoder()
  const key   = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig   = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Enrich inquiry.created payload with flat v2 fields without breaking v1 shape
async function enrichInquiryPayload(
  payload: Record<string, unknown>,
  sb: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>> {
  const productId = payload.product_id as string | undefined

  let publicSlug: string | null = null
  if (productId) {
    const { data } = await sb
      .from('products')
      .select('public_slug')
      .eq('id', productId)
      .single()
    publicSlug = (data as { public_slug: string | null } | null)?.public_slug ?? null
  }

  return {
    // ── v1 fields preserved as-is ──────────────────────────────────────────
    ...payload,

    // ── v2 flat Zapier-friendly additions ──────────────────────────────────
    public_slug:  publicSlug,
    utm_source:   (payload.utm_source  as string | null) ?? null,
    utm_medium:   (payload.utm_medium  as string | null) ?? null,
    referrer:     (payload.referrer    as string | null) ?? null,

    // v2 envelope — mirrors nested data for future consumer versioning
    v2: {
      configuration: payload.configuration ?? [],
    },
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: DeliverBody
  try {
    body = await req.json()
    if (!body.event || !body.tenant_id || !body.payload) throw new Error('missing fields')
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, serviceRoleKey)

  // Enrich payload for inquiry events before delivery
  const outPayload = body.event === 'inquiry.created'
    ? await enrichInquiryPayload(body.payload, sb)
    : body.payload

  // Fetch enabled endpoints subscribed to this event
  const { data: endpoints } = await sb
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('tenant_id', body.tenant_id)
    .eq('enabled', true)

  if (!endpoints?.length) {
    return new Response(JSON.stringify({ ok: true, delivered: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const relevant = (endpoints as EndpointRow[]).filter(
    ep => ep.events.length === 0 || ep.events.includes(body.event)
  )

  const payloadJson = JSON.stringify(outPayload)
  let delivered = 0

  await Promise.allSettled(relevant.map(async (ep) => {
    const sig        = await hmacSha256(ep.secret, payloadJson)
    const deliveryId = crypto.randomUUID()

    // Insert pending delivery record
    await sb.from('webhook_deliveries').insert({
      id:          deliveryId,
      endpoint_id: ep.id,
      event:       body.event,
      payload:     outPayload,
      status:      'pending',
      attempts:    1,
      last_attempt_at: new Date().toISOString(),
    })

    let httpStatus = 0
    let status: 'success' | 'failed' = 'failed'

    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type':          'application/json',
          'X-Webhook-Event':       body.event,
          'X-Webhook-Delivery':    deliveryId,
          'X-Webhook-Signature':   `sha256=${sig}`,
        },
        body: payloadJson,
        signal: AbortSignal.timeout(10_000),
      })
      httpStatus = res.status
      status     = res.ok ? 'success' : 'failed'
      if (res.ok) delivered++
    } catch (err) {
      console.warn(`deliver-webhook: fetch failed for ${ep.url}`, err)
    }

    // Update delivery record
    await sb.from('webhook_deliveries').update({
      status,
      http_status: httpStatus || null,
    }).eq('id', deliveryId)
  }))

  console.log(`deliver-webhook: event=${body.event} tenant=${body.tenant_id} delivered=${delivered}/${relevant.length}`)

  return new Response(JSON.stringify({ ok: true, delivered }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
