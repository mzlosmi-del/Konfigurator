import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import type { Product } from '@/types/database'
import { embedCopiedKey } from '@/components/OnboardingChecklist'
import { THEME_IDS, THEME_META, type ThemeId } from '../../../../../configurator-widget/src/themes'
import { t } from '@/i18n'

interface Props {
  product: Product
}

const WIDGET_CDN_URL    = import.meta.env.VITE_WIDGET_CDN_URL ?? '/widget.js'
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL   ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Public preview page is hosted on Vercel — avoids Supabase gateway CSP/content-type restrictions
const PUBLIC_PREVIEW_BASE = window.location.origin + '/p'

export function EmbedPanel({ product }: Props) {
  const { tenant, planLimits } = useAuthContext()
  const [copied, setCopied]               = useState(false)
  const [linkCopied, setLinkCopied]       = useState(false)
  const [previewKey, setPreviewKey]       = useState(0)
  const [previewEnabled, setPreviewEnabled] = useState(product.public_preview_enabled)
  const [toggling, setToggling]           = useState(false)
  const [removeBranding, setRemoveBranding] = useState(false)
  const [brandingToggling, setBrandingToggling] = useState(false)
  const [qrDataUrl, setQrDataUrl]         = useState<string>('')
  const [selectedStyle, setSelectedStyle] = useState<ThemeId>('cloud')

  const isPublished = product.status === 'published'
  const publicSlug  = product.public_slug
  const publicUrl   = publicSlug ? `${PUBLIC_PREVIEW_BASE}/${publicSlug}` : undefined

  useEffect(() => {
    if (!publicUrl) return
    QRCode.toDataURL(publicUrl, { width: 160, margin: 1, color: { dark: '#111111', light: '#ffffff' } })
      .then(setQrDataUrl)
  }, [publicUrl])

  const previewSrc = (() => {
    const p = new URLSearchParams({
      supabase_url: SUPABASE_URL,
      anon_key:     SUPABASE_ANON_KEY,
      product_id:   product.id,
      tenant_id:    tenant?.id ?? '',
      style:        selectedStyle,
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
    `  data-style="${selectedStyle}"`,
    ...(removeBranding ? ['  data-remove-branding="true"'] : []),
    '></div>',
    `<script src="${WIDGET_CDN_URL}" async></script>`,
  ].join('\n')

  async function handleToggleBranding() {
    setBrandingToggling(true)
    setRemoveBranding(v => !v)
    setBrandingToggling(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    if (tenant) localStorage.setItem(embedCopiedKey(tenant.id), '1')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyLink() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleTogglePreview() {
    setToggling(true)
    const next = !previewEnabled
    const { error } = await supabase
      .from('products')
      .update({ public_preview_enabled: next } as unknown as never)
      .eq('id', product.id)
    if (!error) setPreviewEnabled(next)
    setToggling(false)
  }

  return (
    <div className="space-y-6">
      {!isPublished && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('This product is not published. Publish it first so the widget can load it.')}
        </div>
      )}

      {/* ── Share link ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('Share link')}</p>
        {isPublished && publicSlug ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t('Anyone with this link can preview your configurator without logging in.')}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs truncate">
                {publicUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className="flex-none flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
              >
                {linkCopied
                  ? <><Check className="h-3.5 w-3.5 text-emerald-600" />{t('Copied')}</>
                  : <><Copy className="h-3.5 w-3.5" />{t('Copy')}</>}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
                title={t('Open link')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* QR code */}
            {qrDataUrl && (
              <div className="flex items-start gap-4 pt-1">
                <img src={qrDataUrl} alt="QR code" width={80} height={80} className="rounded border" />
                <div className="text-xs text-muted-foreground space-y-2 pt-1">
                  <p>{t('Scan to open the configurator on any device.')}</p>
                  <a
                    href={qrDataUrl}
                    download={`qr-${product.id.slice(0, 8)}.png`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {t('Download QR')}
                  </a>
                </div>
              </div>
            )}

            {/* Enable / disable toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button
                role="switch"
                aria-checked={previewEnabled}
                disabled={toggling}
                onClick={handleTogglePreview}
                className={[
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  previewEnabled ? 'bg-primary' : 'bg-input',
                  toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                    previewEnabled ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
              <span className="text-sm">
                {previewEnabled ? t('Link is active') : t('Link is disabled')}
              </span>
            </label>
          </>
        ) : isPublished ? (
          <p className="text-sm text-muted-foreground">
            <Link2 className="inline h-3.5 w-3.5 mr-1 opacity-60" />
            {t('A shareable link will appear here once the product is saved after publishing.')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('Publish this product to get a shareable preview link.')}
          </p>
        )}
      </div>

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

      {/* ── Widget style ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('Widget style')}</p>
        <p className="text-sm text-muted-foreground">
          {t('Choose a colour palette and font that matches your site.')}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEME_IDS.map(id => {
            const meta     = THEME_META[id]
            const active   = id === selectedStyle
            const [bg, primary, cta] = meta.colors
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setSelectedStyle(id); setPreviewKey(k => k + 1) }}
                className={[
                  'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all',
                  active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-accent',
                ].join(' ')}
              >
                {/* Color swatches */}
                <div className="flex gap-1">
                  {[bg, primary, cta].map((c, i) => (
                    <span
                      key={i}
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                {/* Font preview */}
                <span
                  className="text-sm font-medium leading-none"
                  style={{ fontFamily: meta.font }}
                >
                  {t(meta.label)}
                </span>
                <span
                  className="text-xs text-muted-foreground leading-none"
                  style={{ fontFamily: meta.font }}
                >
                  Aa Bb Cc
                </span>
              </button>
            )
          })}
        </div>
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

      {/* ── Branding ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('Branding')}</p>
        {planLimits?.remove_branding ? (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={removeBranding}
              disabled={brandingToggling}
              onClick={handleToggleBranding}
              className={[
                'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                removeBranding ? 'bg-primary' : 'bg-input',
              ].join(' ')}
            >
              <span className={[
                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                removeBranding ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')} />
            </button>
            <span className="text-sm">{t('Remove "Powered by Konfigurator" badge')}</span>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('The "Powered by Konfigurator" badge is shown on all widgets. Upgrade to Growth or Scale to remove it.')}
          </p>
        )}
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
