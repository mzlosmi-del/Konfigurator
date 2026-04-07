import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import type { Product } from '@/types/database'

interface Props {
  product: Product
}

// The deployed widget URL — update this after deploying the widget to a CDN
const WIDGET_CDN_URL = 'https://YOUR-WIDGET-CDN-URL/widget.js'

export function EmbedPanel({ product }: Props) {
  const { tenant } = useAuthContext()
  const [copied, setCopied] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

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

  const isPublished = product.status === 'published'

  return (
    <div className="space-y-5">
      {!isPublished && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This product is not published. Publish it first so the widget can load it.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Embed code</p>
        <p className="text-sm text-muted-foreground">
          Paste this snippet into any HTML page where you want the configurator to appear.
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

      <div className="space-y-2">
        <p className="text-sm font-medium">Hosted preview</p>
        <p className="text-sm text-muted-foreground">
          Share this link directly with customers — no embedding required.
        </p>
        <a
          href={`/preview/${product.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open preview page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">How to deploy the widget</p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Build the widget: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">npm run build</code> inside <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">configurator-widget/</code></li>
          <li>Upload <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">dist/widget.js</code> to your CDN (Cloudflare R2, Vercel, etc.)</li>
          <li>Replace <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">YOUR-WIDGET-CDN-URL</code> in the snippet above with your CDN URL</li>
          <li>Paste the snippet into your product page HTML</li>
        </ol>
      </div>
    </div>
  )
}
