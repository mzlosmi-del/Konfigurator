import { useState } from 'react'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

export function SettingsPage() {
  const { tenant, user } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()

  const [notifyEmail, setNotifyEmail] = useState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tenant as any)?.notification_email ?? ''
  )
  const [saving, setSaving] = useState(false)

  async function handleSaveNotifyEmail() {
    if (!tenant) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ notification_email: notifyEmail || null } as unknown as never)
        .eq('id', tenant.id)
      if (error) throw error
      toast({ title: 'Notification email saved' })
    } catch (e) {
      toast({
        title: 'Failed to save',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your account and workspace." />

      <div className="p-6 max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
            <CardDescription>Your tenant details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{tenant?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">{tenant?.slug ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="capitalize">{tenant?.plan ?? '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inquiry notifications</CardTitle>
            <CardDescription>
              Where to send email alerts when a customer submits a new inquiry.
              Defaults to your account email if left blank.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              label="Notification email"
              htmlFor="notify-email"
              hint={`Fallback: ${user?.email ?? 'your account email'}`}
            >
              <Input
                id="notify-email"
                type="email"
                placeholder={user?.email ?? 'you@example.com'}
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
              />
            </FormField>
            <Button size="sm" onClick={handleSaveNotifyEmail} loading={saving}>
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Your login details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
