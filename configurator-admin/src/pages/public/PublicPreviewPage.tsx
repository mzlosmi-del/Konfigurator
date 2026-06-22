import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import type { TenantText } from '@/types/database'

// The public page header must match the language the embedded widget shows.
// The widget reads `localStorage['lang']` (default 'sr'), so mirror that here.
function widgetLang(): 'en' | 'sr' {
  if (typeof localStorage === 'undefined') return 'sr'
  return localStorage.getItem('lang') === 'en' ? 'en' : 'sr'
}

// Resolve one product text slot using the SAME rule as the widget's
// `pickTranslation`: the chosen language's row only, else the raw column.
// We deliberately do NOT cross-fall between sr/en here — the English column is
// the canonical fallback, so an EN view never shows SR text and vice versa.
function pickProductText(
  rows: TenantText[],
  slot: string,
  lang: 'en' | 'sr',
  column: string | null,
): string | null {
  const hit = rows.find(r => r.slot === slot && r.language === lang && r.content?.trim())
  return hit ? hit.content : column
}

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const WIDGET_CDN_URL    = import.meta.env.VITE_WIDGET_CDN_URL    ?? '/widget.js'

// Anon client for the public /p/:slug route. Distinct storageKey + no
// session persistence so the GoTrueClient doesn't clash with the admin
// app's main client when both modules end up in the same bundle.
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:     false,
    autoRefreshToken:   false,
    detectSessionInUrl: false,
    storageKey:         'sb-anon-public-preview',
  },
})

interface Product { id: string; tenant_id: string; name: string; description: string | null; widget_theme: string | null }
interface Tenant  {
  name: string
  plan: string
  favicon_url:       string | null
  public_page_title: string | null
}

export function PublicPreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [tenant,  setTenant]  = useState<Tenant  | null>(null)
  // Translated product name/description (tenant_texts), resolved for the
  // widget's language with the English column as fallback. Defaults to the
  // raw columns until the text rows load.
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string | null>(null)
  const [showBranding, setShowBranding] = useState(true)
  const [whiteLabel,   setWhiteLabel]   = useState(false)
  const [notFound, setNotFound] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const scriptMounted = useRef(false)

  useEffect(() => {
    if (!slug) { setNotFound(true); return }

    anonClient
      .from('products')
      .select('id, tenant_id, name, description, widget_theme')
      .eq('public_slug', slug)
      .eq('status', 'published')
      .eq('public_preview_enabled', true)
      .single()
      .then(async ({ data: prod }) => {
        if (!prod) { setNotFound(true); return }
        setProduct(prod as Product)
        // Seed with the raw columns so the header shows immediately, then
        // override with the translated text once the rows arrive below.
        setName(prod.name)
        setDescription(prod.description)

        // Resolve the product name/description in the widget's language,
        // falling back to the English column when no translation exists.
        anonClient
          .from('tenant_texts')
          .select('level, reference_id, slot, language, content')
          .eq('tenant_id', prod.tenant_id)
          .eq('level', 'product')
          .eq('reference_id', prod.id)
          .in('slot', ['name', 'description'])
          .then(({ data: textRows }) => {
            const rows = (textRows ?? []) as TenantText[]
            const lang = widgetLang()
            setName(pickProductText(rows, 'name', lang, prod.name) ?? prod.name)
            setDescription(pickProductText(rows, 'description', lang, prod.description))
          })

        const [{ data: ten }, { data: limits }] = await Promise.all([
          anonClient.from('tenants').select('name, plan, favicon_url, public_page_title').eq('id', prod.tenant_id).single(),
          anonClient.from('plan_limits').select('remove_branding, white_label').eq('plan', 'free').single(),
        ])
        setTenant(ten as Tenant | null)

        if (ten) {
          const { data: lim } = await anonClient
            .from('plan_limits')
            .select('remove_branding, white_label')
            .eq('plan', (ten as Tenant).plan)
            .single()
          const planLim = lim as { remove_branding: boolean; white_label: boolean } | null
          setShowBranding(!(planLim?.remove_branding ?? false))
          setWhiteLabel(planLim?.white_label ?? false)
        } else {
          setShowBranding(!(limits?.remove_branding ?? false))
        }
      })
  }, [slug])

  // White-label customisation: tenant-controlled favicon and tab title.
  useEffect(() => {
    if (!tenant || !whiteLabel) return
    if (tenant.public_page_title) {
      document.title = tenant.public_page_title
    }
    if (tenant.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = tenant.favicon_url
    }
  }, [tenant, whiteLabel])

  // Inject widget script once product is known
  useEffect(() => {
    if (!product || scriptMounted.current) return
    scriptMounted.current = true
    const s = document.createElement('script')
    s.src = WIDGET_CDN_URL
    s.async = true
    document.body.appendChild(s)
  }, [product])

  if (notFound) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '80px 16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Product not found</h1>
        <p style={{ color: '#666', marginTop: '8px' }}>This link may have expired or the product is no longer available.</p>
      </div>
    )
  }

  if (!product) return null

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', color: '#111', minHeight: '100vh' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 16px 48px' }}>
        {tenant && (
          <p style={{ fontSize: '.75rem', color: '#888', marginBottom: '4px', letterSpacing: '.02em', textTransform: 'uppercase' }}>
            {tenant.name}
          </p>
        )}
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px' }}>{name || product.name}</h1>
        {(description ?? product.description) && (
          <p style={{ fontSize: '.95rem', color: '#555', marginBottom: '24px', lineHeight: 1.5 }}>{description ?? product.description}</p>
        )}

        <div
          ref={widgetRef}
          id="configurator"
          data-supabase-url={SUPABASE_URL}
          data-supabase-anon-key={SUPABASE_ANON_KEY}
          data-product-id={product.id}
          data-tenant-id={product.tenant_id}
          // Carry the product's chosen widget theme so the public link
          // matches the experience the operator configured on the
          // product's Embed panel.
          {...(product.widget_theme ? { 'data-style': product.widget_theme } : {})}
        />

        {showBranding && (
          <p style={{ marginTop: '32px', textAlign: 'center', fontSize: '.75rem', color: '#bbb' }}>
            Powered by{' '}
            <a href="https://configureout.com" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb' }}>
              Configureout
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
