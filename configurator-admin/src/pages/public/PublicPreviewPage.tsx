import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const WIDGET_CDN_URL    = import.meta.env.VITE_WIDGET_CDN_URL    ?? '/widget.js'

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

interface Product { id: string; tenant_id: string; name: string; description: string | null }
interface Tenant  { name: string; plan: string }

export function PublicPreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [tenant,  setTenant]  = useState<Tenant  | null>(null)
  const [showBranding, setShowBranding] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const scriptMounted = useRef(false)

  useEffect(() => {
    if (!slug) { setNotFound(true); return }

    anonClient
      .from('products')
      .select('id, tenant_id, name, description')
      .eq('public_slug', slug)
      .eq('status', 'published')
      .eq('public_preview_enabled', true)
      .single()
      .then(async ({ data: prod }) => {
        if (!prod) { setNotFound(true); return }
        setProduct(prod as Product)

        const [{ data: ten }, { data: limits }] = await Promise.all([
          anonClient.from('tenants').select('name, plan').eq('id', prod.tenant_id).single(),
          anonClient.from('plan_limits').select('remove_branding').eq('plan', 'free').single(),
        ])
        setTenant(ten as Tenant | null)

        if (ten) {
          const { data: lim } = await anonClient
            .from('plan_limits')
            .select('remove_branding')
            .eq('plan', (ten as Tenant).plan)
            .single()
          setShowBranding(!(lim?.remove_branding ?? false))
        } else {
          setShowBranding(!(limits?.remove_branding ?? false))
        }
      })
  }, [slug])

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
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px' }}>{product.name}</h1>
        {product.description && (
          <p style={{ fontSize: '.95rem', color: '#555', marginBottom: '24px', lineHeight: 1.5 }}>{product.description}</p>
        )}

        <div
          ref={widgetRef}
          id="configurator"
          data-supabase-url={SUPABASE_URL}
          data-supabase-anon-key={SUPABASE_ANON_KEY}
          data-product-id={product.id}
          data-tenant-id={product.tenant_id}
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
