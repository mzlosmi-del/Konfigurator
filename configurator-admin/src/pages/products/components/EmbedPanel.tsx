import { useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import type { Product } from '@/types/database'
import { t } from '@/i18n'

interface Props {
  product: Product
}

const WIDGET_CDN_URL    = import.meta.env.VITE_WIDGET_CDN_URL ?? '/widget.js'
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL   ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export function EmbedPanel({ product }: Props) {
  const { tenant } = useAuthContext()
  const [copied, setCopied]       = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const isPublished = product.status === 'published'

  const previewSrc = (() => {
    const p = new URLSearchParams({
      supabase_url: SUPABASE_URL,
      anon_key:     SUPABASE_ANON_KEY,
      product_id:   product.id,
      tenant_id:    tenant?.id ?? '',
    })
    return `/widget-preview.html?${p.toString()}`
  })()

  const snippet = [
    '<!-- Configurator Widget -->',
    '<div',
    `  id="configurator-${product.id.slice(0, 8)}"`,
    `  data-supabase-url="${SUPABASE_URL}"`,
    `  data-supabase-anon-key="${SUPABASE_ANON_KEY}"`,
    `  data-product-id="${product.id}"`,
    `  data-tenant-id="${tenant?.id ?? ''}"`,
    '></div>',
    `<script src="${WIDGET_CDN_URL}" async></script>`,
  ].join('\n')

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {!isPublished && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('This product is not published. Publish it first so the widget can load it.')}
        </div>
      )}

      {/* ── Live preview ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t('Live preview')}</p>
          {isPublished && (
            <button
              onClick={() => setPreviewKey(k => k + 1)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={t('Reload')}
            >
              <RefreshCw className="h-3 w-3" />
              {t('Reload')}
            </button>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden bg-muted/10">
          {isPublished && tenant ? (
            <iframe
              key={previewKey}
              src={previewSrc}
              className="w-full border-0"
              style={{ height: '600px' }}
              title={`Preview: ${product.name}`}
            />
          ) : (
            <div className="flex items-center justify-center h-36 text-sm text-muted-foreground">
              {t('Publish the product to see a live preview.')}
            </div>
          )}
        </div>

        {isPublished && (
          <a
            href={previewSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('Open in new tab')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* ── Embed snippet ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('Embed code')}</p>
        <p className="text-sm text-muted-foreground">
          {t('Paste this into any HTML page to embed the configurator.')}
        </p>
        <div className="relative">
          <pre className="rounded-lg border bg-muted/40 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {snippet}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
          >
            {copied
              ? <><Check className="h-3 w-3 text-emerald-600" /> {t('Copied')}</>
              : <><Copy className="h-3 w-3" /> {t('Copy')}</>}
          </button>
        </div>
      </div>

      {/* ── Deploy instructions ────────────────────────────────────── */}
      <div className="rounded-md border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">{t('Deploying the widget to your site')}</p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>
            Build: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
              cd configurator-widget &amp;&amp; npm run build
            </code>
          </li>
          <li>Upload <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">dist/widget.js</code> to a CDN</li>
          <li>
            Set <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">VITE_WIDGET_CDN_URL</code> in
            your Vercel env vars to update the snippet above
          </li>
          <li>Paste the embed code into your product page</li>
        </ol>
      </div>
    </div>
  )
}
