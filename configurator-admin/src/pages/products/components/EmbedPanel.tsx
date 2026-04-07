import { useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import type { Product } from '@/types/database'

interface Props {
  product: Product
}

const WIDGET_CDN_URL = import.meta.env.VITE_WIDGET_CDN_URL ?? 'https://YOUR-WIDGET-CDN-URL/widget.js'

export function EmbedPanel({ product }: Props) {
  const { tenant } = useAuthContext()
  const [copied, setCopied] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  const isPublished = product.status === 'published'

  const snippet = `<!-- Configurator Widget -->
<div
  id="configurator-${product.id.slice(0, 8)}"
  data-supabase-url="${supabaseUrl}"
  data-supabase-anon-key="${anonKey}"
  data-product-id="${product.id}"
  data-tenant-id="${tenant?.id ?? ''}"
></div>
<script src="${WIDGET_CDN_URL}" async></script>`

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {!isPublished && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This product is not published. Publish it first so the widget can load it.
        </div>
      )}

      {/* ── Live preview ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Live preview</p>
          <button
            onClick={() => setIframeKey(k => k + 1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Reload preview"
          >
            <RefreshCw className="h-3 w-3" />
            Reload
          </button>
        </div>

        <div className="rounded-lg border overflow-hidden bg-muted/20">
          {isPublished ? (
            <iframe
              key={iframeKey}
              src={`/preview/${product.id}`}
              className="w-full border-0"
              style={{ height: '580px' }}
              title={`Preview: ${product.name}`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-2">
              <span>Publish the product to see the live preview.</span>
            </div>
          )}
        </div>

        <a
          href={`/preview/${product.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Open in new tab
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* ── Embed snippet ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Embed code</p>
        <p className="text-sm text-muted-foreground">
          Paste this into any HTML page to embed the configurator.
        </p>
        <div className="relative">
          <pre className="rounded-lg border bg-muted/40 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
          >
            {copied
              ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</>
              : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
      </div>

      {/* ── Deploy instructions ───────────────────────────────────── */}
      <div className="rounded-md border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">How to deploy the widget</p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Build: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">cd configurator-widget && npm run build</code></li>
          <li>Upload <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">dist/widget.js</code> to a CDN (Cloudflare R2, Vercel, etc.)</li>
          <li>Set <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">VITE_WIDGET_CDN_URL</code> in your admin app env vars</li>
          <li>Paste the embed code above into your product page</li>
        </ol>
      </div>
    </div>
  )
}
