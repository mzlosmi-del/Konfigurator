import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/i18n'

const schema = z.object({
  password: z.string().min(8, t('Password must be at least 8 characters')),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: t('Passwords do not match'),
  path: ['confirmPassword'],
})
type FormValues = z.infer<typeof schema>

const logo = (
  <div className="flex flex-col items-center gap-2">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
      <Boxes className="h-5 w-5 text-primary-foreground" />
    </div>
    <span className="text-lg font-semibold">{t('Configurator')}</span>
  </div>
)

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Supabase fires PASSWORD_RECOVERY via onAuthStateChange when the
  // recovery token in the URL hash is parsed (detectSessionInUrl: true)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ password }: FormValues) {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setServerError(error.message)
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {logo}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{t('Checking reset link')}…</CardTitle>
              <CardDescription className="text-center">
                {t('Please wait while we verify your reset link.')}
              </CardDescription>
            </CardHeader>
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
            <CardTitle>{t('Set new password')}</CardTitle>
            <CardDescription>{t('Choose a strong password for your account.')}</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <FormField label={t('New password')} htmlFor="password" error={errors.password?.message} required>
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

            <CardFooter>
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {t('Update password')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
