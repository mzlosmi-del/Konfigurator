import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserCheck, XCircle } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/i18n'

interface InviteRecord {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  tenant: { name: string } | null
}

const schema = z.object({
  password:        z.string().min(8, t('Password must be at least 8 characters')),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: t('Passwords do not match'),
  path:    ['confirmPassword'],
})
type FormValues = z.infer<typeof schema>

const logo = <Logo lockup="vertical" size={72} />

export function InvitePage() {
  const { token }      = useParams<{ token: string }>()
  const navigate       = useNavigate()
  const { session }    = useAuthContext()
  const [invite, setInvite]   = useState<InviteRecord | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  // Validate invite token on mount
  useEffect(() => {
    if (!token) { setInviteError(t('Invalid invite link.')); return }
    supabase
      .from('invitations')
      .select('id, email, role, expires_at, accepted_at, tenant:tenant_id(name)')
      .eq('token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setInviteError(t('Invite not found or already used.')); return }
        const rec = data as unknown as InviteRecord
        if (rec.accepted_at) { setInviteError(t('This invite has already been accepted.')); return }
        if (new Date(rec.expires_at) < new Date()) { setInviteError(t('This invite has expired.')); return }
        setInvite(rec)
      })
  }, [token])

  // If already logged in: accept directly
  async function handleAcceptLoggedIn() {
    if (!session || !token) return
    setAccepting(true)
    setServerError(null)
    const { error } = await supabase.auth.updateUser({
      data: { invite_token: token },
    })
    if (error) {
      setServerError(error.message)
      setAccepting(false)
      return
    }
    // Trigger re-auth to reload profile with new tenant
    await supabase.auth.refreshSession()
    navigate('/dashboard', { replace: true })
  }

  // If not logged in: register with invite token embedded in metadata
  async function onSubmit({ password }: FormValues) {
    if (!invite || !token) return
    setServerError(null)
    const { data, error } = await supabase.auth.signUp({
      email:    invite.email,
      password,
      options: { data: { invite_token: token } },
    })
    if (error) { setServerError(error.message); return }
    if (!data.session) {
      // Email confirmation required — but for invites we ideally skip this.
      // Redirect to login with a message.
      navigate('/login', { replace: true })
      return
    }
    navigate('/dashboard', { replace: true })
  }

  if (inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {logo}
          <Card>
            <CardHeader>
              <div className="flex justify-center mb-2">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-center">{t('Invalid invitation')}</CardTitle>
              <CardDescription className="text-center">{inviteError}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button variant="outline" onClick={() => navigate('/login')}>
                {t('Back to sign in')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {logo}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{t('Checking invite')}…</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const tenantName = (invite.tenant as { name: string } | null)?.name ?? t('a workspace')

  // Logged-in user accepting
  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {logo}
          <Card>
            <CardHeader>
              <div className="flex justify-center mb-2">
                <UserCheck className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-center">{t('Join workspace')}</CardTitle>
              <CardDescription className="text-center">
                {t('You have been invited to join')} <strong>{tenantName}</strong>{' '}
                {t('as')} <strong>{invite.role}</strong>.
              </CardDescription>
            </CardHeader>
            {serverError && (
              <CardContent>
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              </CardContent>
            )}
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" loading={accepting} onClick={handleAcceptLoggedIn}>
                {t('Accept invitation')}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/dashboard')}>
                {t('Cancel')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  // New user — register form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {logo}
        <Card>
          <CardHeader>
            <CardTitle>{t('Accept invitation')}</CardTitle>
            <CardDescription>
              {t('Join')} <strong>{tenantName}</strong> {t('as')} <strong>{invite.role}</strong>.{' '}
              {t('Set a password to create your account.')}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <FormField label={t('Email')} htmlFor="inv-email">
                <Input id="inv-email" type="email" value={invite.email} disabled />
              </FormField>

              <FormField label={t('Password')} htmlFor="inv-password" error={errors.password?.message} required>
                <Input
                  id="inv-password"
                  type="password"
                  placeholder={t('Min. 8 characters')}
                  autoComplete="new-password"
                  {...register('password')}
                />
              </FormField>

              <FormField
                label={t('Confirm password')}
                htmlFor="inv-confirm"
                error={errors.confirmPassword?.message}
                required
              >
                <Input
                  id="inv-confirm"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
              </FormField>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {t('Create account & join')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
