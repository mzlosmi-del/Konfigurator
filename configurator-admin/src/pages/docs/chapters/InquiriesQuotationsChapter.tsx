import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Eye, EyeOff, GripVertical } from 'lucide-react'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
      {n}
    </span>
  )
}

export function InquiriesQuotationsChapter() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">{t('Inquiries & quotations')}</CardTitle>
          <CardDescription>
            {t('What happens when a customer asks for a quote, and how to send one back as a PDF or email.')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ── How an inquiry arrives ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('How an inquiry arrives')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="rounded bg-muted px-2 py-1">{t('Customer fills the widget')}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="rounded bg-muted px-2 py-1">{t('Inquiry POSTed to your workspace')}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="rounded bg-muted px-2 py-1">{t('Notification email (optional)')}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="rounded bg-primary/10 px-2 py-1 text-primary font-medium">{t('Appears in Inquiries with a red "new" dot')}</span>
          </div>
          <p className="text-muted-foreground">
            {t('Set the notification email in Settings → Branding. Without it, you still see inquiries in the admin — you just don\'t get a heads-up.')}
          </p>
        </CardContent>
      </Card>

      {/* ── Status workflow ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Status workflow')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="destructive">{t('New')}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">{t('Read')}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">{t('Replied')}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">{t('Closed')}</Badge>
          </div>
          <p>
            <strong>{t('Important:')}</strong>{' '}
            {t('Changing status via the dropdown does NOT send an email. To actually reply to the customer, use the "Reply by email" button on the inquiry detail page — that opens your mail client (or, if you\'ve created a quotation, lets you send the PDF directly).')}
          </p>
        </CardContent>
      </Card>

      {/* ── Creating a quotation from an inquiry ──────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Creating a quotation from an inquiry')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <StepBadge n={1} />
              <p>{t('Open the inquiry from the Inquiries list.')}</p>
            </div>
            <div className="flex gap-3 items-start">
              <StepBadge n={2} />
              <p>{t('Click "Create quotation". A draft quotation opens with line items pre-filled from the inquiry\'s configuration (product, quantity, selected options, computed price).')}</p>
            </div>
            <div className="flex gap-3 items-start">
              <StepBadge n={3} />
              <p>{t('Edit the line items, add discount / tax adjustments at line or quotation level, and write any notes or terms.')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Quotation lifecycle ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Quotation lifecycle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{t('Draft')}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">{t('Preview')}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">{t('Confirmed')}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">{t('Locked')}</Badge>
          </div>
          <p className="text-muted-foreground">
            {t('Locked quotations are read-only — that\'s by design, so the version the customer received can never change retroactively. To revise a locked quotation, use Duplicate to make a new draft copy.')}
          </p>
        </CardContent>
      </Card>

      {/* ── PDF preview dialog ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('PDF preview dialog')}</CardTitle>
          <CardDescription>
            {t('Click "Preview PDF" on a quotation to fine-tune the layout before generating the final file.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ManualMockup caption={t('Left: section controls (drag to reorder, eye-icon to toggle). Right: live A4 preview of the actual quotation data.')}>
            <div className="grid grid-cols-[180px_1fr] gap-3 p-4 h-56 relative">
              <div className="rounded border bg-card p-2 space-y-1.5 text-xs">
                <div className="font-medium text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{t('Sections')}</div>
                {[
                  { label: 'Header',     visible: true },
                  { label: 'Bill-to',    visible: true },
                  { label: 'Line items', visible: true },
                  { label: 'Notes',      visible: true },
                  { label: 'Terms',      visible: false },
                ].map(({ label, visible }) => (
                  <div key={label} className="flex items-center gap-1.5 rounded border bg-background px-1.5 py-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1">{t(label)}</span>
                    {visible
                      ? <Eye className="h-3 w-3 text-primary" />
                      : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
                <div className="pt-1 flex gap-1">
                  <button className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium">EN</button>
                  <button className="text-[10px] px-2 py-0.5 rounded border">SR</button>
                </div>
              </div>
              <div className="rounded border bg-white p-3 text-[10px] space-y-1.5">
                <div className="font-bold text-sm">Quotation Q-0142</div>
                <div className="text-muted-foreground">Acme Furniture Co. · 2026-03-14</div>
                <div className="border-t pt-1.5 mt-2 space-y-0.5">
                  <div className="flex justify-between"><span>Oak door</span><span>€840</span></div>
                  <div className="flex justify-between"><span>Bay window</span><span>€1,240</span></div>
                </div>
                <div className="flex justify-between border-t pt-1.5 mt-2 font-medium"><span>Total</span><span>€2,080</span></div>
              </div>
              <MockupHotspot n={1} top="22%" left="2%" label={t('Drag to reorder')} />
              <MockupHotspot n={2} top="62%" left="20%" label={t('Toggle visibility')} />
              <MockupHotspot n={3} top="80%" left="2%" label={t('Language switch')} />
            </div>
          </ManualMockup>
          <p>
            {t('The right panel shows what the PDF will actually look like with your data. Toggle a section\'s eye icon to include or omit it without losing the content.')}
          </p>
        </CardContent>
      </Card>

      {/* ── Sending the quotation email ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Sending the quotation email')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            {t('Click "Send to customer" on a confirmed quotation. We send the PDF and an HTML email with the intro text from Settings → Branding.')}
          </p>
          <p>
            {t('The From address depends on your plan: on Scale with a verified domain you send from your own address; on lower plans the email goes from the platform default (replies still come to your notification email).')}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link to="/inquiries"><Button size="sm" variant="default">{t('Open Inquiries')}</Button></Link>
        <Link to="/quotations"><Button size="sm" variant="outline">{t('Open Quotations')}</Button></Link>
      </div>
    </div>
  )
}
