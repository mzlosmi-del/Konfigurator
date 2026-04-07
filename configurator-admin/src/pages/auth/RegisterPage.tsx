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

const schema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type FormValues = z.infer<typeof schema>

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

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const slug = toSlug(values.companyName)

    // Step 1: create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    })

    if (signUpError || !data.user) {
      setServerError(signUpError?.message ?? 'Sign up failed. Please try again.')
      return
    }

    // Step 2: provision tenant + profile via RPC (SECURITY DEFINER function)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase.rpc as any)('create_tenant_for_user', {
      user_id: data.user.id,
      tenant_name: values.companyName,
      tenant_slug: slug,
    })

    if (rpcError) {
      // Clean up: sign out the orphaned auth user
      await supabase.auth.signOut()
      setServerError(
        rpcError.message.includes('unique')
          ? 'A company with that name already exists. Try a different name.'
          : 'Account setup failed. Please try again.'
      )
      return
    }
    // Navigation handled by useEffect once session updates
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Boxes className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Configurator</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Set up your configurator workspace</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <FormField
                label="Company name"
                htmlFor="companyName"
                error={errors.companyName?.message}
                hint="This becomes your workspace name"
                required
              >
                <Input
                  id="companyName"
                  placeholder="Acme Furniture Co."
                  autoComplete="organization"
                  {...register('companyName')}
                />
              </FormField>

              <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
              </FormField>

              <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  {...register('password')}
                />
              </FormField>

              <FormField
                label="Confirm password"
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
                Create account
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
