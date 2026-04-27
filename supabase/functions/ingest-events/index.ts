import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_TYPES = new Set(['view', 'characteristic_changed', 'inquiry_started', 'inquiry_submitted'])
const RATE_LIMIT  = 10   // max requests per session per minute

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  let body: unknown
  try { body = await req.json() } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }

  const { product_id, tenant_id, events } = body as Record<string, unknown>

  if (
    typeof product_id !== 'string' || !product_id ||
    typeof tenant_id  !== 'string' || !tenant_id  ||
    !Array.isArray(events) || events.length === 0 || events.length > 20
  ) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Validate each event
  for (const e of events) {
    if (typeof e !== 'object' || e === null) return new Response('Bad event', { status: 400, headers: CORS })
    const ev = e as Record<string, unknown>
    if (typeof ev.session_id !== 'string' || !ev.session_id) return new Response('Bad event', { status: 400, headers: CORS })
    if (!VALID_TYPES.has(ev.event_type as string))            return new Response('Bad event type', { status: 400, headers: CORS })
    if (ev.payload !== undefined && typeof ev.payload !== 'object') return new Response('Bad payload', { status: 400, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify the product belongs to the tenant
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', product_id)
    .eq('tenant_id', tenant_id)
    .single()

  if (!product) {
    return new Response(JSON.stringify({ error: 'Product not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit: count events from this session in the last minute
  const firstSessionId = (events[0] as Record<string, unknown>).session_id as string
  const windowStart    = new Date(Date.now() - 60_000).toISOString()

  const { count } = await supabase
    .from('widget_events')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', firstSessionId)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= RATE_LIMIT) {
    return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Bulk insert
  const rows = events.map((e: Record<string, unknown>) => ({
    tenant_id,
    product_id,
    session_id: e.session_id as string,
    event_type: e.event_type as string,
    payload:    (e.payload as object) ?? {},
  }))

  const { error } = await supabase.from('widget_events').insert(rows)

  if (error) {
    console.error('ingest-events insert error:', error.message)
    return new Response(JSON.stringify({ error: 'Insert failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, { status: 204, headers: CORS })
})
