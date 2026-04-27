import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const WIDGET_CDN        = Deno.env.get('WIDGET_CDN_URL') ?? ''

// iFrame-safe headers — allow embedding from any origin
const IFRAME_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy':      "frame-ancestors *; script-src 'self' 'unsafe-inline' https: data:; style-src 'self' 'unsafe-inline';",
  'X-Frame-Options':              'ALLOWALL',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: IFRAME_HEADERS })

  // Slug is the last non-empty path segment: /functions/v1/embed/{slug}
  const slug = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  if (!slug) return new Response('Not found', { status: 404, headers: IFRAME_HEADERS })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Anon RLS policy allows this only for published+enabled products
  const { data: product } = await supabase
    .from('products')
    .select('id, tenant_id, name')
    .eq('public_slug', slug)
    .eq('status', 'published')
    .eq('public_preview_enabled', true)
    .single()

  if (!product) {
    return new Response('', {
      status: 404,
      headers: { ...IFRAME_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(buildEmbed(product as { id: string; tenant_id: string; name: string }), {
    headers: { ...IFRAME_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  })
})

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEmbed(product: { id: string; tenant_id: string; name: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${h(product.name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: transparent; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div
    id="configurator"
    data-supabase-url="${h(SUPABASE_URL)}"
    data-supabase-anon-key="${h(SUPABASE_ANON_KEY)}"
    data-product-id="${h(product.id)}"
    data-tenant-id="${h(product.tenant_id)}"
  ></div>
  <script src="${h(WIDGET_CDN)}" async></script>
</body>
</html>`
}
