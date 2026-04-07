import { useParams } from 'react-router-dom'
import { Boxes } from 'lucide-react'

// The preview page loads the widget via a script tag pointing to the CDN.
// In dev, it shows a placeholder with instructions.
const WIDGET_CDN_URL = import.meta.env.VITE_WIDGET_CDN_URL ?? null
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export function PreviewPage() {
  const { productId } = useParams<{ productId: string }>()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header */}
      <header className="border-b bg-white px-6 py-4 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Boxes className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm">Product Configurator</span>
      </header>

      <main className="flex justify-center px-4 py-12">
        {WIDGET_CDN_URL ? (
          // Widget is deployed — render the embed directly
          <div
            id="configurator-preview"
            data-supabase-url={SUPABASE_URL}
            data-supabase-anon-key={SUPABASE_ANON_KEY}
            data-product-id={productId}
            // tenant-id is resolved by the widget via the product's tenant
            // For preview we pass a wildcard and rely on RLS + product lookup
            data-tenant-id="preview"
            ref={(el) => {
              if (!el) return
              // Dynamically load the widget script
              if (!document.querySelector(`script[src="${WIDGET_CDN_URL}"]`)) {
                const s = document.createElement('script')
                s.src = WIDGET_CDN_URL
                s.async = true
                document.body.appendChild(s)
              } else {
                // Script already loaded — manually trigger mount
                const w = (window as any).ConfiguratorWidget
                if (w) w.mount(el)
              }
            }}
          />
        ) : (
          // Dev mode — widget not yet deployed
          <div className="w-full max-w-lg rounded-xl border bg-white p-8 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mx-auto">
              <Boxes className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-base">Widget not yet deployed</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Build and deploy the widget bundle, then add{' '}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                  VITE_WIDGET_CDN_URL
                </code>{' '}
                to your environment variables to enable this preview.
              </p>
            </div>
            <div className="rounded-md bg-muted/60 p-3 text-left text-xs font-mono text-muted-foreground">
              <p># Build widget:</p>
              <p>cd configurator-widget && npm run build</p>
              <p className="mt-2"># Deploy dist/widget.js to CDN, then:</p>
              <p>VITE_WIDGET_CDN_URL=https://your-cdn.com/widget.js</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Product ID: <code className="font-mono">{productId}</code>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
