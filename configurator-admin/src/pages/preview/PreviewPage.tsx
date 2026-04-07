import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

const WIDGET_CDN_URL    = import.meta.env.VITE_WIDGET_CDN_URL ?? null
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Rendered both standalone (/preview/:productId) and inside the admin iframe.
// Loads the deployed widget bundle when VITE_WIDGET_CDN_URL is set.
// Without it, shows a "publish + set CDN URL" prompt — the iframe in EmbedPanel
// always works once the product is published and the CDN is configured.

export function PreviewPage() {
  const { productId } = useParams<{ productId: string }>()
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el || !productId || !WIDGET_CDN_URL) return

    // Set widget data attributes
    el.setAttribute('data-supabase-url', SUPABASE_URL)
    el.setAttribute('data-supabase-anon-key', SUPABASE_ANON_KEY)
    el.setAttribute('data-product-id', productId)
    // tenant-id is not required — the widget resolves it via the product RLS query
    el.setAttribute('data-tenant-id', '')

    // Load the widget script once, then mount
    const existing = document.querySelector<HTMLScriptElement>('[data-cw-script]')
    if (existing) {
      // Script already loaded by a previous render — call mount directly
      const w = (window as Window & {
        ConfiguratorWidget?: { mount: (el: HTMLElement) => void }
      }).ConfiguratorWidget
      if (w) w.mount(el)
      return
    }

    const script = document.createElement('script')
    script.src = WIDGET_CDN_URL
    script.async = true
    script.dataset.cwScript = '1'
    // Widget auto-mounts on load via its own init() — no onload callback needed
    document.body.appendChild(script)

    return () => {
      // Nothing to clean up — widget script is intentionally kept loaded
    }
  }, [productId])

  const showPlaceholder = !WIDGET_CDN_URL

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        {showPlaceholder ? (
          <div className="rounded-xl border bg-white p-8 text-center space-y-3">
            <p className="font-semibold text-sm">Widget preview unavailable</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Build and deploy the widget, then set{' '}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                VITE_WIDGET_CDN_URL
              </code>{' '}
              in your environment variables.
            </p>
            <p className="text-xs text-muted-foreground font-mono">{productId}</p>
          </div>
        ) : (
          <div ref={mountRef} />
        )}
      </div>
    </div>
  )
}
