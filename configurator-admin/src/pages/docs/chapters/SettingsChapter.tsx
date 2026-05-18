import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

export function SettingsChapter() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">{t('Branding, email, team & plan')}</CardTitle>
          <CardDescription>
            {t('Everything under the Settings tab — the controls that change how your workspace looks to customers and who can access it.')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ── Branding ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Branding')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <ul className="space-y-2 text-muted-foreground list-disc pl-5">
            <li>
              <strong className="text-foreground">{t('Logo')}</strong> —{' '}
              {t('PNG or JPG up to 2 MB. Appears on PDFs and on the public preview page. Square or wide is fine; we don\'t crop.')}
            </li>
            <li>
              <strong className="text-foreground">{t('PDF footer')}</strong> —{' '}
              {t('Replaces the "Configureout" attribution at the bottom of every quotation PDF.')}{' '}
              <Badge variant="secondary" className="ml-1 text-[10px]">{t('Scale plan')}</Badge>
            </li>
            <li>
              <strong className="text-foreground">{t('Widget footer')}</strong> —{' '}
              {t('Toggle the "Powered by Configureout" footer in your embedded widget. Available on Growth and Scale; locked on Free and Starter.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Notification email')}</strong> —{' '}
              {t('Where we send a heads-up when a new inquiry arrives. Defaults to your account email.')}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Email from-address ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Email from-address')}</CardTitle>
          <CardDescription>
            {t('Send quotation emails from your own domain (e.g. quotes@yourcompany.com) instead of the platform default.')}{' '}
            <Badge variant="secondary" className="ml-1 text-[10px]">{t('Scale plan')}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>{t('Three steps:')}</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>{t('Register your domain in Settings → Email from-address.')}</li>
            <li>{t('Copy the DNS records we show and add them at your domain registrar.')}</li>
            <li>{t('Click "Re-check verification" periodically until the banner turns green.')}</li>
          </ol>

          <ManualMockup caption={t('Three verification states — green when DNS records are detected and validated, amber while propagation is in flight, red if records are missing or wrong.')}>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="rounded border-l-2 border-green-600 bg-green-50 dark:bg-green-950/40 px-3 py-2">
                {t('Domain verified. Emails will send from your address below.')}
              </div>
              <div className="rounded border-l-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
                {t('DNS records detected, waiting for propagation. This can take up to 48 hours — re-check periodically.')}
              </div>
              <div className="rounded border-l-2 border-red-600 bg-red-50 dark:bg-red-950/40 px-3 py-2">
                {t('Verification failed. Double-check the DNS records, then re-check — or remove and re-register the domain.')}
              </div>
            </div>
          </ManualMockup>
          <p className="text-muted-foreground text-xs">
            {t('Propagation usually finishes within an hour, but some registrars cache for up to 48 hours. The amber state is normal — don\'t panic if it sits there.')}
          </p>
        </CardContent>
      </Card>

      {/* ── Team ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Team')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            {t('Invite teammates by email and choose their role. They get an email with a link that auto-creates their account inside your workspace.')}
          </p>
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded border p-3">
              <div className="font-medium">{t('Admin')}</div>
              <div className="text-muted-foreground mt-1">{t('Full access including team, plan, audit log, danger zone.')}</div>
            </div>
            <div className="rounded border p-3">
              <div className="font-medium">{t('Member')}</div>
              <div className="text-muted-foreground mt-1">{t('Edit products, inquiries, quotations. Cannot manage team or plan.')}</div>
            </div>
            <div className="rounded border p-3">
              <div className="font-medium">{t('Viewer')}</div>
              <div className="text-muted-foreground mt-1">{t('Read-only access. Cannot save changes.')}</div>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            {t('Fine-tune each role\'s access per feature in Settings → Authorizations (admin-only).')}
          </p>
        </CardContent>
      </Card>

      {/* ── Plan ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Plan')}</CardTitle>
          <CardDescription>
            {t('See your current usage against plan limits and upgrade or downgrade via Stripe Checkout.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <ManualMockup caption={t('Usage bars show how close you are to each plan limit.')}>
            <div className="p-4 space-y-2.5 relative">
              <div>
                <div className="flex justify-between text-xs mb-1"><span>{t('Products')}</span><span className="text-muted-foreground">3 / 10</span></div>
                <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: '30%' }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>{t('Inquiries this month')}</span><span className="text-muted-foreground">42 / ∞</span></div>
                <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: '20%' }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>{t('Team members')}</span><span className="text-muted-foreground">1 / 1</span></div>
                <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-destructive" style={{ width: '100%' }} /></div>
              </div>
              <MockupHotspot n={1} top="68%" left="52%" label={t('At limit — upgrade to add more')} />
            </div>
          </ManualMockup>
          <p className="text-muted-foreground">
            {t('On downgrade, no data is deleted. Over-limit resources become read-only (e.g. excess products keep showing in the list but customers can\'t configure them); restore full access by upgrading again.')}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link to="/settings"><Button size="sm" variant="default">{t('Open Settings')}</Button></Link>
      </div>
    </div>
  )
}
