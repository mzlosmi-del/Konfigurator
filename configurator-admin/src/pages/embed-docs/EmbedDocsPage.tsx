import { useState } from 'react'
import { Copy, Check, Code2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { t } from '@/i18n'

const WIDGET_CDN_URL    = import.meta.env.VITE_WIDGET_CDN_URL ?? 'https://cdn.konfigurator.app/widget.js'
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL   ?? 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'YOUR_ANON_KEY'
const FUNCTIONS_URL     = SUPABASE_URL.replace('/rest/v1', '') + '/functions/v1'

const PRODUCT_ID_PLACEHOLDER = 'YOUR_PRODUCT_ID'
const TENANT_ID_PLACEHOLDER  = 'YOUR_TENANT_ID'

function dataAttrs(productId = PRODUCT_ID_PLACEHOLDER, tenantId = TENANT_ID_PLACEHOLDER) {
  return `  data-supabase-url="${SUPABASE_URL}"\n  data-supabase-anon-key="${SUPABASE_ANON_KEY}"\n  data-product-id="${productId}"\n  data-tenant-id="${tenantId}"`
}

const SCRIPT_SNIPPET = `<!-- Configurator Widget — Script tag method -->
<div
  id="configurator"
${dataAttrs()}
></div>
<script src="${WIDGET_CDN_URL}" async></script>`

const WEB_COMPONENT_SNIPPET = `<!-- Configurator Widget — Web Component method -->
<script src="${WIDGET_CDN_URL}" async></script>

<konfigurator-widget
${dataAttrs()}
></konfigurator-widget>`

function iframeSnippet(slug: string) {
  const src = `${FUNCTIONS_URL}/embed/${slug || 'YOUR_PRODUCT_SLUG'}`
  return `<!-- Configurator Widget — iFrame method -->
<iframe
  src="${src}"
  width="100%"
  height="600"
  frameborder="0"
  allowtransparency="true"
  title="Product Configurator"
></iframe>`
}

interface CopyButtonProps { text: string }

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
      {copied ? t('Copied') : t('Copy')}
    </Button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <CopyButton text={code} />
      </div>
      <pre className="rounded-md bg-muted px-4 pt-4 pb-4 text-xs overflow-x-auto leading-relaxed font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
      {n}
    </span>
  )
}

export function EmbedDocsPage() {
  const [iframeSlug, setIframeSlug] = useState('')
  const [tab, setTab] = useState('script')

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Embed options')}
        description={t('Three ways to add the configurator widget to your website.')}
      />

      <div className="px-6 pt-2 max-w-3xl space-y-6 pb-12">

        {/* Method comparison */}
        <Card>
          <CardContent className="pt-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">{t('Method')}</th>
                    <th className="text-left py-2 pr-4 font-medium">{t('Best for')}</th>
                    <th className="text-left py-2 font-medium">{t('Notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2.5 pr-4"><Badge variant="secondary">Script tag</Badge></td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{t('Most websites, CMS')}</td>
                    <td className="py-2.5 text-muted-foreground">{t('Paste one snippet, widget mounts automatically')}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4"><Badge variant="secondary">Web Component</Badge></td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{t('React, Vue, Angular apps')}</td>
                    <td className="py-2.5 text-muted-foreground">{t('Custom element — place anywhere in JSX/templates')}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4"><Badge variant="secondary">iFrame</Badge></td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{t('Strict CSP, no-JS sites')}</td>
                    <td className="py-2.5 text-muted-foreground">{t('Full isolation; requires a published public slug')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="script">
              <Code2 className="h-3.5 w-3.5 mr-1.5" />
              {t('Script tag')}
            </TabsTrigger>
            <TabsTrigger value="webcomponent">{t('Web Component')}</TabsTrigger>
            <TabsTrigger value="iframe">{t('iFrame')}</TabsTrigger>
          </TabsList>

          {/* ── Script tag ───────────────────────────────────────────────────── */}
          <TabsContent value="script" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Script tag embed')}</CardTitle>
                <CardDescription>
                  {t('Add the snippet below to any HTML page. The widget mounts automatically on elements that have a')} <code className="text-xs bg-muted px-1 rounded">data-product-id</code> {t('attribute.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StepBadge n={1} />
                    <span className="text-sm font-medium">{t('Copy the snippet')}</span>
                  </div>
                  <CodeBlock code={SCRIPT_SNIPPET} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StepBadge n={2} />
                    <span className="text-sm font-medium">{t('Replace the placeholder IDs')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('Find your')} <code className="text-xs bg-muted px-1 rounded">data-product-id</code> {t('and')} <code className="text-xs bg-muted px-1 rounded">data-tenant-id</code> {t('on the product Embed tab in the admin.')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StepBadge n={3} />
                    <span className="text-sm font-medium">{t('Publish the product')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('The widget will only load data for published products. Set status to Published in the product editor.')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Web Component ─────────────────────────────────────────────────── */}
          <TabsContent value="webcomponent" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Web Component embed')}</CardTitle>
                <CardDescription>
                  {t('Use the')} <code className="text-xs bg-muted px-1 rounded">&lt;konfigurator-widget&gt;</code> {t('custom element anywhere a standard HTML element is valid, including inside React and Vue components.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock code={WEB_COMPONENT_SNIPPET} />

                <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p className="font-medium">{t('React usage note')}</p>
                  <p>{t('TypeScript will warn about unknown JSX elements. Add a declaration file:')}</p>
                  <code className="block mt-1 text-xs font-mono bg-blue-100 dark:bg-blue-900 rounded px-2 py-1">
                    {`declare namespace JSX {\n  interface IntrinsicElements {\n    'konfigurator-widget': React.HTMLAttributes<HTMLElement> & {\n      'data-product-id': string\n      'data-tenant-id': string\n      'data-supabase-url': string\n      'data-supabase-anon-key': string\n    }\n  }\n}`}
                  </code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── iFrame ───────────────────────────────────────────────────────── */}
          <TabsContent value="iframe" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('iFrame embed')}</CardTitle>
                <CardDescription>
                  {t('Fully isolated embed served from the Configureout CDN. Suitable for strict Content Security Policy environments. Requires the product to be published with a public share link.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('Public slug')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="abc123xyz0"
                      value={iframeSlug}
                      onChange={e => setIframeSlug(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('Copy the slug from the share link on the product Embed tab.')}
                  </p>
                </div>

                <CodeBlock code={iframeSnippet(iframeSlug)} />

                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">{t('Sizing tips')}</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    <li>{t('Set width to 100% and adjust height to fit your layout (400–700 px is typical).')}</li>
                    <li>{t('The iframe background is transparent — it inherits your page background.')}</li>
                    <li>{t('For responsive height, use a ResizeObserver on the iframe with postMessage from the widget (advanced).')}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Webhook section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('Webhook payload (v2)')}</CardTitle>
            <CardDescription>
              {t('When a customer submits an inquiry, Configureout fires an')} <code className="text-xs bg-muted px-1 rounded">inquiry.created</code> {t('webhook with the payload below. Configure webhook endpoints in Settings → Webhooks.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`{
  // ── v1 fields (always present) ───────────────────────────
  "inquiry_id":     "uuid",
  "customer_name":  "Jane Smith",
  "customer_email": "jane@example.com",
  "product_name":   "Custom Desk",
  "product_id":     "uuid",
  "total_price":    599.00,
  "currency":       "EUR",
  "configuration":  [
    { "characteristic_name": "Material", "value_label": "Walnut", "price_modifier": 100 }
  ],
  "created_at":     "2024-01-15T10:30:00Z",

  // ── v2 flat additions (Zapier-friendly) ──────────────────
  "public_slug":    "abc123xyz0",
  "utm_source":     null,
  "utm_medium":     null,
  "referrer":       null,

  // ── v2 envelope ──────────────────────────────────────────
  "v2": {
    "configuration": [ /* same as top-level configuration */ ]
  }
}`} />
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
