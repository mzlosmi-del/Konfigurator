import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Code2 } from 'lucide-react'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

export function EmbedChapter() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            {t('Embedding the widget')}
          </CardTitle>
          <CardDescription>
            {t('Three integration methods, all served from one widget bundle. Pick the one that fits your site.')}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('The three methods')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded border p-3 space-y-1">
              <Badge variant="secondary">{t('Script tag')}</Badge>
              <div className="font-medium">{t('Most websites, CMS')}</div>
              <div className="text-muted-foreground">{t('Paste one snippet, widget mounts automatically.')}</div>
            </div>
            <div className="rounded border p-3 space-y-1">
              <Badge variant="secondary">{t('Web Component')}</Badge>
              <div className="font-medium">{t('React, Vue, Angular apps')}</div>
              <div className="text-muted-foreground">{t('Custom element — place anywhere in JSX/templates.')}</div>
            </div>
            <div className="rounded border p-3 space-y-1">
              <Badge variant="secondary">{t('iFrame')}</Badge>
              <div className="font-medium">{t('Strict CSP, no-JS sites')}</div>
              <div className="text-muted-foreground">{t('Full isolation; requires a published public slug.')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Where to find the snippet')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            {t('Open any published product, click the Embed tab. The snippet is ready to copy. Pick a theme to change the widget\'s visual style — the choice is saved per product, so different products on the same site can look different.')}
          </p>
          <ManualMockup caption={t('Embed tab on a product — copy the script, paste it into your HTML.')}>
            <div className="p-4 relative">
              <div className="rounded border bg-card p-3 space-y-2">
                <div className="text-xs font-medium">{t('Script tag')}</div>
                <pre className="rounded bg-muted px-3 py-2 text-[10px] font-mono overflow-x-auto whitespace-pre">{`<div data-product-id="..."></div>
<script src="https://cdn.../widget.js" async></script>`}</pre>
                <div className="flex justify-end">
                  <button className="text-[10px] rounded border px-2 py-0.5">{t('Copy')}</button>
                </div>
              </div>
              <MockupHotspot n={1} top="68%" left="80%" label={t('Copy & paste')} />
            </div>
          </ManualMockup>
          <p className="text-muted-foreground text-xs">
            {t('The Embed tab on the product is the simplest path. For the full reference (Web Component + iFrame snippets, comparison table, copy buttons), open the Embed page from the sidebar.')}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link to="/embed-docs"><Button size="sm" variant="default">{t('Full embed reference')}</Button></Link>
        <Link to="/products"><Button size="sm" variant="outline">{t('Open Products')}</Button></Link>
      </div>
    </div>
  )
}
