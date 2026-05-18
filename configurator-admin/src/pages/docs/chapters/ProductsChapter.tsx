import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

interface TabSpec { label: string; body: string }

const TABS: TabSpec[] = [
  {
    label: 'Details',
    body: 'Name, description, base price, currency and SKU. The Status field controls visibility: Draft is editor-only, Published is live and embeddable, Archived hides the product without deleting data.',
  },
  {
    label: 'Characteristics',
    body: 'The options customers pick from. Four types: text (free input), single-select (one of N values), numeric (a number with optional min/max), and boolean (a single checkbox). Each value can carry a price modifier — flat amount or percent — applied to the running total.',
  },
  {
    label: 'Rules',
    body: 'If/then logic. Conditions look at characteristic selections; effects can show, hide, or lock other characteristics. Useful for dependent options (e.g. "Glass thickness" only appears when "Material = Glass"). Rules evaluate every time a customer changes a selection.',
  },
  {
    label: 'Formula pricing',
    body: 'Surcharges computed from characteristic values — e.g. price per m² × width × height. Build expressions from characteristic IDs, constants, and the standard math operators. Use the Pricing center for tax and discount logic at the product or quotation level.',
  },
  {
    label: 'Visualization',
    body: 'Image assets tied to characteristic values. When a customer picks a value, the matching image layers into the widget preview. For 3D models, mesh rules map characteristic values to visible meshes inside a single GLB file.',
  },
  {
    label: 'Form',
    body: 'The fields shown in the inquiry form after the customer clicks "Request a quote". Toggle which fields appear (name, email, phone, company, message) and which are required.',
  },
  {
    label: 'Embed',
    body: 'The snippet to paste on your site, plus a theme picker (Cloud, Forest, Slate, Sand, etc.) that changes the widget\'s visual style. Theme is stored per product so different products on the same site can look different.',
  },
  {
    label: 'Texts',
    body: 'Shortcut to Central Texts, pre-filtered to this product. Edit customer-facing strings (characteristic names, value labels, descriptions) in English and Serbian here.',
  },
  {
    label: 'History',
    body: 'Audit log of every save and delete on this product, with a before/after diff. Admin-only.',
  },
]

export function ProductsChapter() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">{t('Products & configuration')}</CardTitle>
          <CardDescription>
            {t('Each product has nine tabs in the editor. Work through them roughly in order — Details first, then Characteristics, then everything else as needed.')}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('The nine tabs')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ManualMockup caption={t('Product editor — tabs across the top, Publish button on the right')}>
            <div className="p-5 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-muted-foreground">← {t('All products')}</div>
                <button className="rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5">{t('Publish')}</button>
              </div>
              <div className="flex flex-wrap gap-1 border-b pb-2">
                {TABS.map(({ label }, i) => (
                  <span
                    key={label}
                    className={`text-xs px-2.5 py-1 rounded ${
                      i === 1
                        ? 'bg-background border border-border text-foreground font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {t(label)}
                  </span>
                ))}
              </div>
              <div className="mt-4 h-20 rounded bg-muted/40 border border-dashed" />
              <MockupHotspot n={1} top="8%" left="68%" label={t('Publish here')} />
              <MockupHotspot n={2} top="38%" left="14%" label={t('Tabs in suggested order')} />
            </div>
          </ManualMockup>
        </CardContent>
      </Card>

      {TABS.map(({ label, body }) => (
        <Card key={label}>
          <CardHeader>
            <CardTitle className="text-base">{t(label)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t(body)}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Link to="/products"><Button size="sm" variant="default">{t('Open Products')}</Button></Link>
        <Link to="/library"><Button size="sm" variant="outline">{t('Library (reusable characteristic classes)')}</Button></Link>
      </div>
    </div>
  )
}
