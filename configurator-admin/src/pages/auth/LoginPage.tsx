import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/i18n'

type FormValues = { email: string; password: string }

export function LoginPage() {
  const navigate = useNavigate()
  const { session } = useAuthContext()
  const [serverError, setServerError] = useState<string | null>(null)

  // Navigate only once the auth context has actually picked up the session
  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session])

  const schema = z.object({
    email: z.string().email(t('Enter a valid email')),
    password: z.string().min(1, t('Password is required')),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) {
      setServerError(error.message)
    }
    // Navigation is handled by the useEffect above once session updates
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Boxes className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">{t('Configurator')}</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('Sign in')}</CardTitle>
            <CardDescription>{t('Enter your email and password to continue')}</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
              </FormField>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {t('Sign in')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("Don't have an account?")}{' '}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  {t('Create one')}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
