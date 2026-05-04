import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/i18n'

const schema = z.object({
  email: z.string().email(t('Enter a valid email')),
})
type FormValues = z.infer<typeof schema>

const logo = <Logo lockup="vertical" size={72} />

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ email }: FormValues) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    // Always show confirmation to avoid email enumeration
    setSubmittedEmail(email)
    setSent(true)
  }

  if (sent) {
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
                {t('We sent a password reset link to')}{' '}
                <strong>{submittedEmail}</strong>.
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
            <CardTitle>{t('Reset your password')}</CardTitle>
            <CardDescription>{t("Enter your email and we'll send you a reset link.")}</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField label={t('Email')} htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('you@example.com')}
                  autoComplete="email"
                  {...register('email')}
                />
              </FormField>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {t('Send reset link')}
              </Button>
              <Link to="/login" className="text-sm text-center text-muted-foreground hover:text-foreground">
                {t('Back to sign in')}
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
