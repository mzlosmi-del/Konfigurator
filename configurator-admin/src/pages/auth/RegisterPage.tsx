import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/i18n'

type FormValues = { companyName: string; email: string; password: string; confirmPassword: string }

// Derive a URL-safe slug from the company name
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { session } = useAuthContext()
  const [serverError, setServerError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session])

  const schema = z.object({
    companyName: z.string().min(2, t('Company name must be at least 2 characters')),
    email: z.string().email(t('Enter a valid email')),
    password: z.string().min(8, t('Password must be at least 8 characters')),
    confirmPassword: z.string(),
  }).refine(d => d.password === d.confirmPassword, {
    message: t('Passwords do not match'),
    path: ['confirmPassword'],
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const slug = toSlug(values.companyName)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          tenant_name: values.companyName,
          tenant_slug: slug,
        },
      },
    })

    if (signUpError || !data.user) {
      setServerError(
        signUpError?.message?.includes('unique') || signUpError?.message?.includes('duplicate')
          ? t('A company with that name already exists. Try a different name.')
          : signUpError?.message ?? t('Sign up failed. Please try again.')
      )
      return
    }

    if (!data.session) {
      // Email confirmation required
      setSubmittedEmail(values.email)
      setEmailSent(true)
      return
    }
    // Session available immediately (confirmation disabled) — useEffect navigates
  }

  const logo = (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
        <Boxes className="h-5 w-5 text-primary-foreground" />
      </div>
      <span className="text-lg font-semibold">{t('Configurator')}</span>
    </div>
  )

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {logo}
          <Card>
            <CardHeader>
              <div className="flex justify-center mb-2">
                <MailCheck className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-center">{t('Check your email')}</CardTitle>
              <CardDescription className="text-center">
                {t('We sent a verification link to')}{' '}
                <strong>{submittedEmail}</strong>.{' '}
                {t('Click the link to activate your account.')}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                {t('Back to sign in')}
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {logo}

        <Card>
          <CardHeader>
            <CardTitle>{t('Create your account')}</CardTitle>
            <CardDescription>{t('Set up your configurator workspace')}</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <FormField
                label={t('Company name')}
                htmlFor="companyName"
                error={errors.companyName?.message}
                hint={t('This becomes your workspace name')}
                required
              >
                <Input
                  id="companyName"
                  placeholder={t('Acme Furniture Co.')}
                  autoComplete="organization"
                  {...register('companyName')}
                />
              </FormField>

              <FormField label={t('Email')} htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('you@example.com')}
                  autoComplete="email"
                  {...register('email')}
                />
              </FormField>

              <FormField label={t('Password')} htmlFor="password" error={errors.password?.message} required>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('Min. 8 characters')}
                  autoComplete="new-password"
                  {...register('password')}
                />
              </FormField>

              <FormField
                label={t('Confirm password')}
                htmlFor="confirmPassword"
                error={errors.confirmPassword?.message}
                required
              >
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
              </FormField>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {t('Create account')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('Already have an account?')}{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  {t('Sign in')}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
