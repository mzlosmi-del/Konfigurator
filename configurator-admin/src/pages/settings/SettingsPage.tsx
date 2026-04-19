import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

export function SettingsPage() {
  const { tenant, user } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [notifyEmail, setNotifyEmail] = useState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tenant as any)?.notification_email ?? ''
  )
  const [saving, setSaving] = useState(false)

  // Company profile state
  const [companyAddress, setCompanyAddress] = useState((tenant as any)?.company_address ?? '')
  const [companyPhone,   setCompanyPhone]   = useState((tenant as any)?.company_phone   ?? '')
  const [companyEmail,   setCompanyEmail]   = useState((tenant as any)?.company_email   ?? '')
  const [companyWebsite, setCompanyWebsite] = useState((tenant as any)?.company_website ?? '')
  const [contactPerson,  setContactPerson]  = useState((tenant as any)?.contact_person  ?? '')
  const [logoUrl,        setLogoUrl]        = useState((tenant as any)?.logo_url        ?? '')
  const [savingProfile,  setSavingProfile]  = useState(false)
  const [uploadingLogo,  setUploadingLogo]  = useState(false)

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
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      const url = data.publicUrl
      await supabase.from('tenants').update({ logo_url: url } as unknown as never).eq('id', tenant.id)
      setLogoUrl(url)
      toast({ title: t('Logo uploaded') })
    } catch (e) {
      toast({ title: t('Logo upload failed'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSaveProfile() {
    if (!tenant) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('tenants').update({
        company_address: companyAddress.trim() || null,
        company_phone:   companyPhone.trim()   || null,
        company_email:   companyEmail.trim()   || null,
        company_website: companyWebsite.trim() || null,
        contact_person:  contactPerson.trim()  || null,
      } as unknown as never).eq('id', tenant.id)
      if (error) throw error
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

      <div className="p-6 max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Workspace')}</CardTitle>
            <CardDescription>{t('Your tenant details')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Name')}</span>
              <span className="font-medium">{tenant?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Slug')}</span>
              <span className="font-mono text-xs">{tenant?.slug ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Plan')}</span>
              <span className="capitalize">{tenant?.plan ?? '—'}</span>
            </div>
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

            <Button size="sm" onClick={handleSaveProfile} loading={savingProfile}>
              {t('Save company profile')}
            </Button>
          </CardContent>
        </Card>

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
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
