import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

interface StubProps {
  title: string
  body: string
  links: Array<{ to: string; label: string }>
}

function Stub({ title, body, links }: StubProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-display">{t(title)}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        <p className="text-muted-foreground">{t(body)}</p>
        <div className="flex flex-wrap gap-2">
          {links.map(({ to, label }) => (
            <Link key={to} to={to}>
              <Button size="sm" variant="outline">{t(label)}</Button>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground italic">
          {t('A detailed walkthrough for this chapter is on the way. For now, the page itself is mostly self-explanatory once you\'re there.')}
        </p>
      </CardContent>
    </Card>
  )
}

export function PricingStub() {
  return (
    <Stub
      title="Pricing center"
      body="Edit base-price schedules, characteristic modifiers, tax presets and quotation-level adjustments in one place. Schedules carry valid_from / valid_to dates so you can prepare a price change in advance and have it activate on the right day."
      links={[{ to: '/pricing', label: 'Open Pricing center' }]}
    />
  )
}

export function LibraryStub() {
  return (
    <Stub
      title="Library & central texts"
      body="The Library page groups reusable characteristics into classes so you can reuse the same options across products. The Texts page is the central editor for every customer-facing string in English and Serbian — characteristic names, value labels, descriptions, post-inquiry messages."
      links={[
        { to: '/library', label: 'Open Library' },
        { to: '/texts',   label: 'Open Texts' },
      ]}
    />
  )
}

export function AnalyticsStub() {
  return (
    <Stub
      title="Analytics"
      body="Per-product views, inquiries and conversion rate, plus revenue over time. The characteristic-value breakdown shows which options customers actually pick, and the inquiry-to-quotation funnel helps you spot leaks in the workflow."
      links={[{ to: '/analytics', label: 'Open Analytics' }]}
    />
  )
}

export function AuditStub() {
  return (
    <Stub
      title="Audit log"
      body="Admin-only. Every save and delete across products, quotations, characteristics, formulas and settings is logged with a before/after diff. Filter by entity type and date range. Use it to investigate who changed what."
      links={[{ to: '/audit-log', label: 'Open Audit log' }]}
    />
  )
}
