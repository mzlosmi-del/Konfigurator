import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, CreditCard, Globe, Pencil, Plus, RefreshCw, Trash2, Upload, UserMinus, UserPlus, X, Zap } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  fetchRejectionReasons,
  createRejectionReason,
  updateRejectionReason,
  deleteRejectionReason,
} from '@/lib/quotations'
import { fetchPublishedProductCount } from '@/lib/products'
import { planLabel } from '@/lib/planLimits'
import type { MonthlyUsageRow, QuotationRejectionReason } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

// ── Types for new sections ─────────────────────────────────────────────────────

interface TeamMember   { id: string; email: string | null; role: string }
interface Invitation   { id: string; email: string; role: string; expires_at: string }
interface WebhookEndpoint {
  id: string; url: string; secret: string
  events: string[]; enabled: boolean; created_at: string
}
interface WebhookDelivery {
  id: string; event: string; status: string
  http_status: number | null; created_at: string
}

const WEBHOOK_EVENTS = ['inquiry.created', 'quotation.status_changed'] as const

// ── Small presentational helpers ──────────────────────────────────────────────

function UsageRow({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = max < 0
  const pct       = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100))
  const over      = !unlimited && used >= max
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={over ? 'text-destructive font-medium' : ''}>
          {used}{unlimited ? '' : ` / ${max}`}
          {over && <span className="ml-1">({t('limit reached')})</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function FeatureRow({ label, enabled, note }: { label: string; enabled: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={enabled ? 'text-primary' : 'text-muted-foreground/50'}>
        {enabled ? '✓' : '✗'}
      </span>
      <span className={enabled ? '' : 'text-muted-foreground/60'}>{label}</span>
      {note && <span className="ml-auto text-muted-foreground capitalize">{note}</span>}
    </div>
  )
}

export function SettingsPage() {
  const { tenant, user, planLimits, refreshTenant } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()
  const navigate     = useNavigate()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [notifyEmail, setNotifyEmail] = useState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tenant as any)?.notification_email ?? ''
  )
  const [saving, setSaving] = useState(false)

  // Company profile state
  const [companyAddress, setCompanyAddress] = useState(tenant?.company_address ?? '')
  const [companyPhone,   setCompanyPhone]   = useState(tenant?.company_phone   ?? '')
  const [companyEmail,   setCompanyEmail]   = useState(tenant?.company_email   ?? '')
  const [companyWebsite, setCompanyWebsite] = useState(tenant?.company_website ?? '')
  const [contactPerson,     setContactPerson]     = useState(tenant?.contact_person  ?? '')
  const [logoUrl,           setLogoUrl]           = useState(tenant?.logo_url        ?? '')
  const [vatNumber,         setVatNumber]         = useState((tenant as any)?.vat_number          ?? '')
  const [companyRegNumber,  setCompanyRegNumber]  = useState((tenant as any)?.company_reg_number  ?? '')
  const [savingProfile,     setSavingProfile]     = useState(false)
  const [uploadingLogo,     setUploadingLogo]     = useState(false)

  async function handleSaveNotifyEmail() {
    if (!tenant) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ notification_email: notifyEmail || null } as unknown as never)
        .eq('id', tenant.id)
      if (error) throw error
      toast({ title: t('Notification email saved') })
    } catch (e) {
      toast({
        title: t('Failed to save'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    if (!tenant) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t('File too large'), description: t('Max 2 MB'), variant: 'destructive' })
      return
    }
    setUploadingLogo(true)
    try {
      const ext  = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
      const path = `${tenant.id}/logo.${ext}`
      const { error: storageError } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
      if (storageError) throw new Error(storageError.message)
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      const url = data.publicUrl
      const { error: dbError } = await supabase.from('tenants').update({ logo_url: url } as unknown as never).eq('id', tenant.id)
      if (dbError) throw new Error(dbError.message)
      setLogoUrl(url)
      await refreshTenant()
      toast({ title: t('Logo uploaded') })
    } catch (e) {
      toast({ title: t('Logo upload failed'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setUploadingLogo(false)
    }
  }

  // ── Rejection reasons ──────────────────────────────────────────────────────
  const [reasons,    setReasons]    = useState<QuotationRejectionReason[]>([])
  const [newLabel,   setNewLabel]   = useState('')
  const [addingR,    setAddingR]    = useState(false)
  const [editingRId, setEditingRId] = useState<string | null>(null)
  const [editLabel,  setEditLabel]  = useState('')
  const [savingR,    setSavingR]    = useState(false)
  const [toDeleteR,  setToDeleteR]  = useState<QuotationRejectionReason | null>(null)
  const [deletingR,  setDeletingR]  = useState(false)

  // ── Product count + monthly usage (for plan usage) ───────────────────────
  const [productCount,  setProductCount]  = useState<number | null>(null)
  const [monthlyUsage,  setMonthlyUsage]  = useState<MonthlyUsageRow | null>(null)

  useEffect(() => {
    if (!tenant?.id) return
    fetchPublishedProductCount(tenant.id).then(setProductCount).catch(() => {})
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    const period = new Date()
    period.setDate(1)
    const periodStr = period.toISOString().slice(0, 10)
    supabase
      .from('monthly_usage')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('period_month', periodStr)
      .maybeSingle()
      .then(({ data }) => { if (data) setMonthlyUsage(data as MonthlyUsageRow) })
  }, [tenant?.id])

  // ── Team ───────────────────────────────────────────────────────────────────
  const [members,       setMembers]       = useState<TeamMember[]>([])
  const [invitations,   setInvitations]   = useState<Invitation[]>([])
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviteRole,    setInviteRole]    = useState('member')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [revokingId,    setRevokingId]    = useState<string | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('id, email, role').then(({ data }) => {
      if (data) setMembers(data as TeamMember[])
    })
    if (tenant) {
      supabase.from('invitations').select('id, email, role, expires_at')
        .eq('tenant_id', tenant.id).is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .then(({ data }) => { if (data) setInvitations(data as Invitation[]) })
    }
  }, [tenant?.id])

  async function handleSendInvite() {
    if (!inviteEmail.trim()) return
    setSendingInvite(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('send-invite', {
        body: { email: inviteEmail.trim(), role: inviteRole },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) {
        // 409 = email already a member of this workspace
        const status = (res.error as { context?: Response }).context?.status
        if (status === 409) {
          toast({ title: t('Already a member'), description: t('This person is already a member of your workspace.'), variant: 'destructive' })
          return
        }
        throw new Error(res.error.message)
      }
      const { data: newInv } = await supabase.from('invitations')
        .select('id, email, role, expires_at')
        .eq('email', inviteEmail.trim())
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (newInv) setInvitations(prev => [...prev, newInv as Invitation])
      setInviteEmail('')
      const { emailSent, inviteUrl } = (res.data ?? {}) as { emailSent?: boolean; inviteUrl?: string }
      if (emailSent === false && inviteUrl) {
        toast({
          title: t('Invitation created — email not sent'),
          description: `${t('Share this link manually:')} ${inviteUrl}`,
          variant: 'destructive',
        })
      } else {
        toast({ title: t('Invitation sent') })
      }
    } catch (e) {
      toast({ title: t('Failed to send invitation'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleRevokeInvite(id: string) {
    setRevokingId(id)
    await supabase.from('invitations').delete().eq('id', id)
    setInvitations(prev => prev.filter(i => i.id !== id))
    setRevokingId(null)
  }

  // ── Webhooks ────────────────────────────────────────────────────────────────
  const [webhooks,       setWebhooks]       = useState<WebhookEndpoint[]>([])
  const [whUrl,          setWhUrl]          = useState('')
  const [whEvents,       setWhEvents]       = useState<string[]>([...WEBHOOK_EVENTS])
  const [addingWh,       setAddingWh]       = useState(false)
  const [newSecret,      setNewSecret]      = useState<{ id: string; secret: string } | null>(null)
  const [deliveriesMap,  setDeliveriesMap]  = useState<Record<string, WebhookDelivery[]>>({})
  const [expandedWh,     setExpandedWh]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('webhook_endpoints').select('*').order('created_at')
      .then(({ data }) => { if (data) setWebhooks(data as WebhookEndpoint[]) })
  }, [])

  async function handleAddWebhook() {
    if (!whUrl.trim().startsWith('https://')) {
      toast({ title: t('URL must start with https://'), variant: 'destructive' }); return
    }
    setAddingWh(true)
    try {
      const { data, error } = await supabase.from('webhook_endpoints')
        .insert({ url: whUrl.trim(), events: whEvents } as never)
        .select().single()
      if (error) throw new Error(error.message)
      const ep = data as WebhookEndpoint
      setWebhooks(prev => [...prev, ep])
      setNewSecret({ id: ep.id, secret: ep.secret })
      setWhUrl('')
    } catch (e) {
      toast({ title: t('Failed to add webhook'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setAddingWh(false)
    }
  }

  async function handleToggleWebhook(ep: WebhookEndpoint) {
    const { data } = await supabase.from('webhook_endpoints')
      .update({ enabled: !ep.enabled } as never).eq('id', ep.id).select().single()
    if (data) setWebhooks(prev => prev.map(w => w.id === ep.id ? data as WebhookEndpoint : w))
  }

  async function handleDeleteWebhook(id: string) {
    await supabase.from('webhook_endpoints').delete().eq('id', id)
    setWebhooks(prev => prev.filter(w => w.id !== id))
    if (expandedWh === id) setExpandedWh(null)
  }

  async function handleLoadDeliveries(epId: string) {
    if (expandedWh === epId) { setExpandedWh(null); return }
    setExpandedWh(epId)
    if (deliveriesMap[epId]) return
    const { data } = await supabase.from('webhook_deliveries')
      .select('id, event, status, http_status, created_at')
      .eq('endpoint_id', epId).order('created_at', { ascending: false }).limit(20)
    setDeliveriesMap(prev => ({ ...prev, [epId]: (data ?? []) as WebhookDelivery[] }))
  }

  // ── Danger zone ─────────────────────────────────────────────────────────────
  // ── Billing ─────────────────────────────────────────────────────────────────
  const [settingsTab,       setSettingsTab]       = useState('general')
  const [checkoutLoading,   setCheckoutLoading]   = useState<string | null>(null)
  const [portalLoading,     setPortalLoading]     = useState(false)

  async function handleUpgrade(plan: string, interval: 'monthly' | 'annual') {
    setCheckoutLoading(`${plan}-${interval}`)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, interval },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const { url } = res.data as { url: string }
      window.location.href = url
    } catch (e) {
      toast({ title: t('Failed to start checkout'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      setCheckoutLoading(null)
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('create-billing-portal-session', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const { url } = res.data as { url: string }
      window.location.href = url
    } catch (e) {
      toast({ title: t('Failed to open billing portal'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setPortalLoading(false)
    }
  }

  // ── Danger zone ─────────────────────────────────────────────────────────────
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deletingAccount,    setDeletingAccount]    = useState(false)

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      await supabase.auth.signOut()
      navigate('/register', { replace: true })
    } catch (e) {
      toast({ title: t('Failed to delete workspace'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      setDeletingAccount(false)
    }
  }

  useEffect(() => {
    fetchRejectionReasons().then(setReasons).catch(() => {})
  }, [])

  async function handleAddReason() {
    if (!newLabel.trim()) return
    setAddingR(true)
    try {
      const r = await createRejectionReason(newLabel.trim(), reasons.length)
      setReasons(prev => [...prev, r])
      setNewLabel('')
    } catch (e) {
      toast({ title: t('Failed to add reason'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setAddingR(false)
    }
  }

  async function handleSaveReason() {
    if (!editingRId || !editLabel.trim()) return
    setSavingR(true)
    try {
      const r = await updateRejectionReason(editingRId, editLabel.trim())
      setReasons(prev => prev.map(x => x.id === editingRId ? r : x))
      setEditingRId(null)
    } catch (e) {
      toast({ title: t('Failed to save reason'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSavingR(false)
    }
  }

  async function handleDeleteReason() {
    if (!toDeleteR) return
    setDeletingR(true)
    try {
      await deleteRejectionReason(toDeleteR.id)
      setReasons(prev => prev.filter(x => x.id !== toDeleteR.id))
      setToDeleteR(null)
    } catch (e) {
      toast({ title: t('Failed to delete reason'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setDeletingR(false)
    }
  }

  async function handleSaveProfile() {
    if (!tenant) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('tenants').update({
        company_address:    companyAddress.trim()   || null,
        company_phone:      companyPhone.trim()     || null,
        company_email:      companyEmail.trim()     || null,
        company_website:    companyWebsite.trim()   || null,
        contact_person:     contactPerson.trim()    || null,
        vat_number:         vatNumber.trim()        || null,
        company_reg_number: companyRegNumber.trim() || null,
      } as unknown as never).eq('id', tenant.id)
      if (error) throw error
      await refreshTenant()
      toast({ title: t('Company profile saved') })
    } catch (e) {
      toast({ title: t('Failed to save'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('Settings')} description={t('Manage your account and workspace.')} />

      <div className="px-6 pt-2">
        <Tabs value={settingsTab} onValueChange={setSettingsTab}>
          <TabsList>
            <TabsTrigger value="general">{t('General')}</TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              {t('Billing')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {t('Workspace')}
              <Badge variant="secondary" className="capitalize font-normal">
                {planLabel(tenant?.plan ?? 'free')}
              </Badge>
            </CardTitle>
            <CardDescription>{t('Your tenant details and plan usage')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Name')}</span>
              <span className="font-medium">{tenant?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Slug')}</span>
              <span className="font-mono text-xs">{tenant?.slug ?? '—'}</span>
            </div>

            {planLimits && (
              <div className="space-y-2.5 border-t pt-3 mt-1">
                {/* Products */}
                {productCount !== null && (
                  <UsageRow
                    label={t('Products')}
                    used={productCount}
                    max={planLimits.products_max}
                  />
                )}

                {/* Inquiries this month */}
                <UsageRow
                  label={t('Inquiries this month')}
                  used={monthlyUsage?.inquiries_count ?? 0}
                  max={planLimits.inquiries_per_month}
                />

                {/* Team seats */}
                <UsageRow
                  label={t('Team members')}
                  used={members.length}
                  max={planLimits.team_members_max}
                />

                {/* Feature flags */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                  <FeatureRow label={t('3D models')}     enabled={planLimits.three_d} />
                  <FeatureRow label={t('Quotations')}    enabled={planLimits.quotations} />
                  <FeatureRow label={t('Webhooks')}      enabled={planLimits.webhooks} />
                  <FeatureRow label={t('Remove branding')} enabled={planLimits.remove_branding} />
                  <FeatureRow label={t('Analytics')}     enabled={true} note={planLimits.analytics} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Company Profile')}</CardTitle>
            <CardDescription>{t('This information appears on generated PDF quotations.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('Logo')}</p>
              <div className="flex items-center gap-4">
                <div className="h-14 w-36 rounded border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl
                    ? <img src={logoUrl} alt="logo" className="max-h-full max-w-full object-contain" />
                    : <span className="text-xs text-muted-foreground uppercase tracking-wide">Logo</span>
                  }
                </div>
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                  />
                  <Button size="sm" variant="outline" loading={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {t('Upload logo')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">{t('PNG or JPG, max 2 MB')}</p>
                </div>
              </div>
            </div>

            <FormField label={t('Contact person')} htmlFor="contact-person">
              <Input
                id="contact-person"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder={t('e.g. Jane Smith')}
              />
            </FormField>

            <FormField label={t('Address')} htmlFor="company-address">
              <Textarea
                id="company-address"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                rows={3}
                placeholder={t('Street, City, Country')}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('Phone')} htmlFor="company-phone">
                <Input
                  id="company-phone"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </FormField>
              <FormField label={t('Email')} htmlFor="company-email">
                <Input
                  id="company-email"
                  type="email"
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </FormField>
            </div>

            <FormField label={t('Website')} htmlFor="company-website">
              <Input
                id="company-website"
                value={companyWebsite}
                onChange={e => setCompanyWebsite(e.target.value)}
                placeholder="https://www.company.com"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('VAT Number')} htmlFor="vat-number">
                <Input
                  id="vat-number"
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                  placeholder={t('e.g. DE123456789')}
                />
              </FormField>
              <FormField label={t('Company Reg. Number')} htmlFor="company-reg-number">
                <Input
                  id="company-reg-number"
                  value={companyRegNumber}
                  onChange={e => setCompanyRegNumber(e.target.value)}
                  placeholder={t('e.g. HRB 12345')}
                />
              </FormField>
            </div>

            <Button size="sm" onClick={handleSaveProfile} loading={savingProfile}>
              {t('Save company profile')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Rejection Reasons')}</CardTitle>
            <CardDescription>
              {t('Predefined reasons shown when marking a quotation as rejected.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reasons.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('No reasons defined yet.')}</p>
            )}
            <div className="space-y-1.5">
              {reasons.map(r => (
                editingRId === r.id ? (
                  <div key={r.id} className="flex items-center gap-2">
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveReason(); if (e.key === 'Escape') setEditingRId(null) }}
                    />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSaveReason} loading={savingR}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingRId(null)} disabled={savingR}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div key={r.id} className="flex items-center gap-2 group">
                    <span className="flex-1 text-sm py-1">{r.label}</span>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setEditingRId(r.id); setEditLabel(r.label) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => setToDeleteR(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder={t('e.g. Price too high')}
                className="flex-1 h-8 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') handleAddReason() }}
              />
              <Button size="sm" onClick={handleAddReason} loading={addingR} disabled={!newLabel.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('Add')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={!!toDeleteR}
          onOpenChange={open => { if (!open) setToDeleteR(null) }}
          title={t('Delete rejection reason')}
          description={t('This reason will be removed. Existing quotations linked to it will keep the reference but the label will no longer resolve.')}
          confirmLabel={t('Delete')}
          onConfirm={handleDeleteReason}
          loading={deletingR}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Inquiry notifications')}</CardTitle>
            <CardDescription>
              {t('Where to send email alerts when a customer submits a new inquiry. Defaults to your account email if left blank.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              label={t('Notification email')}
              htmlFor="notify-email"
              hint={`Fallback: ${user?.email ?? 'your account email'}`}
            >
              <Input
                id="notify-email"
                type="email"
                placeholder={user?.email ?? t('you@example.com')}
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
              />
            </FormField>
            <Button size="sm" onClick={handleSaveNotifyEmail} loading={saving}>
              {t('Save')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Account')}</CardTitle>
            <CardDescription>{t('Your login details')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Email')}</span>
              <span className="font-medium">{user?.email ?? '—'}</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Team ──────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Team')}</CardTitle>
            <CardDescription>{t('Invite colleagues to your workspace.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current members */}
            {members.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Members')}</p>
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1">
                    <span>{m.email ?? m.id}</span>
                    <Badge variant="outline" className="capitalize text-xs">{m.role}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Pending invitations')}</p>
                {invitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-sm py-1">
                    <div>
                      <span>{inv.email}</span>
                      <Badge variant="secondary" className="capitalize text-xs ml-2">{inv.role}</Badge>
                    </div>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      loading={revokingId === inv.id}
                      onClick={() => handleRevokeInvite(inv.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Invite form */}
            {(() => {
              const atTeamLimit = planLimits && planLimits.team_members_max >= 0 && members.length >= planLimits.team_members_max
              return (
                <div className="space-y-2 pt-1 border-t">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-2">{t('Invite member')}</p>
                  {atTeamLimit ? (
                    <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                      {t('Team member limit reached for your plan. Upgrade to add more members.')}
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder={t('colleague@company.com')}
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          onKeyDown={e => { if (e.key === 'Enter') handleSendInvite() }}
                        />
                        <Select
                          value={inviteRole}
                          onChange={e => setInviteRole(e.target.value)}
                          className="h-8 text-sm w-28"
                        >
                          <option value="admin">{t('Admin')}</option>
                          <option value="member">{t('Member')}</option>
                          <option value="viewer">{t('Viewer')}</option>
                        </Select>
                      </div>
                      <Button size="sm" onClick={handleSendInvite} loading={sendingInvite} disabled={!inviteEmail.trim()}>
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                        {t('Send invitation')}
                      </Button>
                    </>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* ── Webhooks ──────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {t('Webhooks')}
            </CardTitle>
            <CardDescription>{t('Receive HTTP POST events when inquiries or quotations change.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planLimits && !planLimits.webhooks && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t('Webhooks are available on the Growth plan and above.')}
                <button className="ml-1 underline text-primary" onClick={() => setSettingsTab('billing')}>{t('Upgrade')}</button>
              </div>
            )}
            {/* Existing endpoints */}
            {webhooks.length > 0 && (
              <div className="space-y-2">
                {webhooks.map(ep => (
                  <div key={ep.id} className="rounded-md border text-sm">
                    <div className="flex items-center gap-2 p-3">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 font-mono text-xs truncate">{ep.url}</span>
                      <Badge variant={ep.enabled ? 'default' : 'secondary'} className="text-xs">
                        {ep.enabled ? t('Active') : t('Disabled')}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleToggleWebhook(ep)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteWebhook(ep.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleLoadDeliveries(ep.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="px-3 pb-2 flex flex-wrap gap-1">
                      {ep.events.map(ev => (
                        <Badge key={ev} variant="outline" className="text-xs font-mono">{ev}</Badge>
                      ))}
                    </div>
                    {/* Secret shown once */}
                    {newSecret?.id === ep.id && (
                      <div className="mx-3 mb-3 rounded bg-muted/50 p-2 text-xs">
                        <p className="font-medium mb-1">{t('Secret (shown once — copy now)')}</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 break-all font-mono">{newSecret.secret}</code>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(newSecret.secret); toast({ title: t('Secret copied') }) }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Deliveries */}
                    {expandedWh === ep.id && (
                      <div className="border-t px-3 pb-3 pt-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{t('Recent deliveries')}</p>
                        {(deliveriesMap[ep.id] ?? []).length === 0
                          ? <p className="text-xs text-muted-foreground">{t('No deliveries yet.')}</p>
                          : (deliveriesMap[ep.id] ?? []).map(d => (
                            <div key={d.id} className="flex items-center gap-2 py-0.5 text-xs">
                              <Badge variant={d.status === 'success' ? 'default' : 'destructive'} className="text-xs">{d.http_status ?? d.status}</Badge>
                              <span className="font-mono text-muted-foreground">{d.event}</span>
                              <span className="ml-auto text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add endpoint form */}
            {planLimits?.webhooks && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Add endpoint')}</p>
                <Input
                  placeholder="https://example.com/webhook"
                  value={whUrl}
                  onChange={e => setWhUrl(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
                <div className="flex flex-wrap gap-3">
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whEvents.includes(ev)}
                        onChange={e => setWhEvents(prev => e.target.checked ? [...prev, ev] : prev.filter(x => x !== ev))}
                        className="h-3 w-3"
                      />
                      <span className="font-mono">{ev}</span>
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={handleAddWebhook} loading={addingWh} disabled={!whUrl.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t('Add endpoint')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Danger Zone ───────────────────────────────────────────────────── */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">{t('Danger Zone')}</CardTitle>
            <CardDescription>{t('Permanently delete your workspace and all its data.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('Type your workspace slug')} <strong className="font-mono">{tenant?.slug}</strong> {t('to confirm deletion.')}
            </p>
            <Input
              placeholder={tenant?.slug ?? 'workspace-slug'}
              value={deleteConfirmInput}
              onChange={e => setDeleteConfirmInput(e.target.value)}
              className="max-w-xs h-8 text-sm font-mono"
            />
            <Button
              variant="destructive"
              size="sm"
              loading={deletingAccount}
              disabled={deleteConfirmInput !== (tenant?.slug ?? '')}
              onClick={handleDeleteAccount}
            >
              <UserMinus className="h-3.5 w-3.5 mr-1.5" />
              {t('Delete workspace')}
            </Button>
          </CardContent>
        </Card>
        </TabsContent>

          {/* ── Billing tab ─────────────────────────────────────────────────── */}
          <TabsContent value="billing" className="mt-4 max-w-2xl space-y-4">

            {/* Current plan + usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {t('Current plan')}
                  <Badge variant="secondary" className="capitalize font-normal">
                    {planLabel(tenant?.plan ?? 'free')}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {(tenant as any)?.subscription_status
                    ? `${t('Subscription status')}: ${(tenant as any).subscription_status}`
                    : t('No active subscription — on free plan.')}
                </CardDescription>
              </CardHeader>
              {planLimits && (
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <UsageRow label={t('Products')}           used={productCount ?? 0} max={planLimits.products_max} />
                    <UsageRow label={t('Inquiries this month')} used={monthlyUsage?.inquiries_count ?? 0} max={planLimits.inquiries_per_month} />
                    <UsageRow label={t('Team members')}       used={members.length}    max={planLimits.team_members_max} />
                    <UsageRow label={t('AI setups this month')} used={monthlyUsage?.ai_setup_count ?? 0} max={planLimits.ai_setup_per_month} />
                  </div>
                  {(tenant as any)?.stripe_subscription_id && (
                    <Button size="sm" variant="outline" loading={portalLoading} onClick={handleManageSubscription}>
                      {t('Manage subscription & invoices')}
                    </Button>
                  )}
                  {(tenant as any)?.grace_period_ends_at && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {t('Payment failed. Service continues until')} {new Date((tenant as any).grace_period_ends_at).toLocaleDateString()}.
                      {' '}{t('Update your payment method to avoid downgrade.')}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Over-limit banner */}
            {(tenant as any)?.subscription_status === 'canceled' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {t('Some resources are read-only because your workspace exceeds the free plan limits. Upgrade to restore full access — your data is safe.')}
              </div>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {([
                { plan: 'starter', label: 'Starter', monthly: '49', annual: '490', features: ['25 products', '250 inquiries/mo', '3 team members', '3D models', 'Quotations'] },
                { plan: 'growth',  label: 'Growth',  monthly: '149', annual: '1490', features: ['Unlimited products', '2000 inquiries/mo', '10 team members', 'Webhooks', 'Advanced analytics', 'Remove branding'] },
                { plan: 'scale',   label: 'Scale',   monthly: '399', annual: '3990', features: ['Everything unlimited', 'White-label', 'AI product setup ∞', 'Priority support'] },
              ] as const).map(({ plan, label, monthly, annual, features }) => {
                const isCurrent = tenant?.plan === plan
                return (
                  <Card key={plan} className={isCurrent ? 'border-primary' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                      <div className="text-2xl font-bold">€{monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-xs text-muted-foreground">€{annual}/yr (save 2 months)</div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-1">
                        {features.map(f => (
                          <li key={f} className="flex items-center gap-1.5 text-xs">
                            <Check className="h-3 w-3 text-primary shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <Badge variant="secondary" className="w-full justify-center">{t('Current plan')}</Badge>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm" className="w-full"
                            loading={checkoutLoading === `${plan}-monthly`}
                            onClick={() => handleUpgrade(plan, 'monthly')}
                          >
                            {t('Monthly')}
                          </Button>
                          <Button
                            size="sm" variant="outline" className="w-full"
                            loading={checkoutLoading === `${plan}-annual`}
                            onClick={() => handleUpgrade(plan, 'annual')}
                          >
                            {t('Annual')} (−17%)
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
