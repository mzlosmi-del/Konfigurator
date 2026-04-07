import { useNavigate } from 'react-router-dom'
import { createProduct } from '@/lib/products'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProductForm, type ProductFormValues } from './components/ProductForm'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

export function NewProductPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()

  async function handleSubmit(values: ProductFormValues) {
    try {
      const product = await createProduct({
        name: values.name,
        description: values.description ?? null,
        base_price: values.base_price,
        currency: values.currency,
      })
      navigate(`/products/${product.id}/edit`, { replace: true })
    } catch (e) {
      toast({
        title: 'Failed to create product',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="New product"
        description="Start by giving your product a name and base price."
      />

      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product details</CardTitle>
            <CardDescription>
              You can add characteristics and options after saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductForm
              onSubmit={handleSubmit}
              submitLabel="Create product"
              onCancel={() => navigate('/products')}
            />
          </CardContent>
        </Card>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
