import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LayoutDashboard, Inbox, Package, Mail } from 'lucide-react'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
      {n}
    </span>
  )
}

export function GettingStarted() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">{t('Welcome to Configureout')}</CardTitle>
          <CardDescription>
            {t('This guide walks you from sign in to a published configurator embedded on your website. Plan on 10–15 minutes for the basics.')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ── Signing in ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Signing in')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            {t('Open the admin at your workspace URL and enter the email and password you registered with. If you forgot your password, click "Forgot password?" on the sign-in screen — we email you a reset link.')}
          </p>
          <p className="text-muted-foreground">
            {t('Workspace owners can invite teammates from Settings → Team. Invitees get an email with a link that auto-creates their account.')}
          </p>
        </CardContent>
      </Card>

      {/* ── Dashboard tour ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Dashboard tour')}</CardTitle>
          <CardDescription>
            {t('After signing in, the dashboard summarises your workspace at a glance.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ManualMockup caption={t('Dashboard — three stat cards and the recent-inquiries table')}>
            <div className="p-5 space-y-4 relative">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Package className="h-3 w-3" /> {t('Published products')}</div>
                  <div className="text-xl font-semibold mt-1">3</div>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Inbox className="h-3 w-3" /> {t('New inquiries')}</div>
                  <div className="text-xl font-semibold mt-1">7</div>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><LayoutDashboard className="h-3 w-3" /> {t('Total inquiries')}</div>
                  <div className="text-xl font-semibold mt-1">42</div>
                </div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs font-medium mb-2">{t('Recent inquiries')}</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>· Anna K. — Oak door — <Badge variant="destructive" className="ml-1 text-[10px]">{t('New')}</Badge></div>
                  <div>· Marko P. — Bay window — €1,240</div>
                  <div>· Lisa M. — Steel door — €890</div>
                </div>
              </div>
              <MockupHotspot n={1} top="14%" left="6%" label={t('Stat cards — click any to drill in')} />
              <MockupHotspot n={2} top="65%" left="6%" label={t('Click a row to open the inquiry')} />
            </div>
          </ManualMockup>
          <p>
            {t('Each stat card is a shortcut: click "Published products" to jump to the Products page, "New inquiries" to filter inquiries to unread, and so on.')}
          </p>
        </CardContent>
      </Card>

      {/* ── First product in 5 minutes ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('First product in 5 minutes')}</CardTitle>
          <CardDescription>
            {t('A minimal walkthrough — one product, one characteristic, one embed snippet.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex gap-3 items-start">
            <StepBadge n={1} />
            <div>
              <div className="font-medium">{t('Open Products and click "New product"')}</div>
              <p className="text-muted-foreground mt-0.5">
                {t('From the sidebar choose Products, then the green "New product" button in the top-right of the list.')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <StepBadge n={2} />
            <div>
              <div className="font-medium">{t('Fill in the Details tab')}</div>
              <p className="text-muted-foreground mt-0.5">
                {t('Name, base price, currency. The SKU is optional. Status stays as Draft until you publish.')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <StepBadge n={3} />
            <div>
              <div className="font-medium">{t('Add one Characteristic with two values')}</div>
              <p className="text-muted-foreground mt-0.5">
                {t('Switch to the Characteristics tab. Add a characteristic (e.g. "Color"), then add two values (e.g. "Black" +€0, "White" +€20). Customers will pick from these in the widget.')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <StepBadge n={4} />
            <div>
              <div className="font-medium">{t('Publish the product')}</div>
              <p className="text-muted-foreground mt-0.5">
                {t('Click Publish in the top-right of the product editor. The status flips to Published and the product becomes embeddable.')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <StepBadge n={5} />
            <div>
              <div className="font-medium">{t('Grab the embed snippet')}</div>
              <p className="text-muted-foreground mt-0.5">
                {t('Open the Embed tab on the same product. Copy the Script tag snippet and paste it into any HTML page on your website — the widget will mount automatically where the snippet sits.')}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <Link to="/products"><Button size="sm" variant="default">{t('Open Products')}</Button></Link>
            <Link to="/embed-docs"><Button size="sm" variant="outline">{t('Full embed reference')}</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ── What's next ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {t("What's next")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('Once the widget is live, customer inquiries land in the Inquiries tab. See the Inquiries & quotations chapter to learn the reply workflow.')}</p>
          <p>{t('For a custom From-address on quotation emails, see Settings → Email. For team invites, see Settings → Team.')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
