import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const WIDGET_CDN        = Deno.env.get('WIDGET_CDN_URL') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // Slug is the last non-empty path segment: /functions/v1/public-preview/{slug}
  const slug = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  if (!slug) return new Response('Not found', { status: 404, headers: CORS })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Anon RLS policy allows this only for published+enabled products
  const { data: product } = await supabase
    .from('products')
    .select('id, tenant_id, name, description')
    .eq('public_slug', slug)
    .eq('status', 'published')
    .eq('public_preview_enabled', true)
    .single()

  if (!product) {
    return new Response(notFoundPage(), {
      status: 404,
      headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, plan, logo_url')
    .eq('id', product.tenant_id)
    .single()

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('remove_branding')
    .eq('plan', tenant?.plan ?? 'free')
    .single()

  const showBranding = !(limits?.remove_branding ?? false)

  return new Response(buildPage(product, tenant, showBranding), {
    headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' },
  })
})

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildPage(
  product: { id: string; tenant_id: string; name: string; description: string | null },
  tenant:  { name: string; logo_url: string | null } | null,
  showBranding: boolean,
): string {
  const pageTitle = tenant ? `${h(product.name)} — ${h(tenant.name)}` : h(product.name)
  const branding  = showBranding
    ? `<p class="branding">Powered by <a href="https://konfigurator.app" target="_blank" rel="noopener noreferrer">Konfigurator</a></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; color: #111; min-height: 100vh; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 16px 48px; }
    .meta  { font-size: .75rem; color: #888; margin-bottom: 4px; letter-spacing: .02em; text-transform: uppercase; }
    h1     { font-size: 1.6rem; font-weight: 700; margin-bottom: 8px; }
    .desc  { font-size: .95rem; color: #555; margin-bottom: 24px; line-height: 1.5; }
    .branding { margin-top: 32px; text-align: center; font-size: .75rem; color: #bbb; }
    .branding a { color: #bbb; }
  </style>
</head>
<body>
  <div class="wrap">
    ${tenant ? `<p class="meta">${h(tenant.name)}</p>` : ''}
    <h1>${h(product.name)}</h1>
    ${product.description ? `<p class="desc">${h(product.description)}</p>` : ''}

    <div
      id="configurator"
      data-supabase-url="${h(SUPABASE_URL)}"
      data-supabase-anon-key="${h(SUPABASE_ANON_KEY)}"
      data-product-id="${h(product.id)}"
      data-tenant-id="${h(product.tenant_id)}"
    ></div>
    <script src="${h(WIDGET_CDN)}" async></script>

    ${branding}
  </div>
</body>
</html>`
}

function notFoundPage(): string {
  return `<!DOCTYPE html><html><head><title>Not found</title></head><body style="font-family:system-ui;text-align:center;padding:80px 16px"><h1 style="font-size:1.5rem;font-weight:600">Product not found</h1><p style="color:#666;margin-top:8px">This link may have expired or the product is no longer available.</p></body></html>`
}

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
