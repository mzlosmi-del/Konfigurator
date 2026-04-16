import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchProduct, updateProduct } from '@/lib/products'
import type { Product } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ProductForm, productToFormValues, type ProductFormValues } from './components/ProductForm'
import { CharacteristicsPanel } from './components/CharacteristicsPanel'
import { RulesPanel } from './components/RulesPanel'
import { FormulaPanel } from './components/FormulaPanel'
import { VisualizationPanel } from './components/VisualizationPanel'
import { EmbedPanel } from './components/EmbedPanel'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

type Tab = 'details' | 'characteristics' | 'rules' | 'formulas' | 'visualization' | 'embed'

const TAB_LABELS: Record<Tab, string> = {
  details:         'Details',
  characteristics: 'Characteristics',
  rules:           'Rules',
  formulas:        'Formula pricing',
  visualization:   'Visualization',
  embed:           'Embed',
}

const statusVariant: Record<Product['status'], 'success' | 'warning' | 'secondary'> = {
  published: 'success',
  draft: 'warning',
  archived: 'secondary',
}

export function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('details')

  useEffect(() => {
    if (!id) return
    fetchProduct(id)
      .then(setProduct)
      .catch(() => toast({ title: 'Product not found', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSaveDetails(values: ProductFormValues) {
    if (!product) return
    try {
      const updated = await updateProduct(product.id, {
        name: values.name,
        description: values.description ?? null,
        base_price: values.base_price,
        currency: values.currency,
      })
      setProduct(updated as Product)
      toast({ title: 'Product saved' })
    } catch (e) {
      toast({
        title: 'Failed to save product',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function handleTogglePublish() {
    if (!product) return
    const next = product.status === 'published' ? 'draft' : 'published'
    try {
      const updated = await updateProduct(product.id, { status: next })
      setProduct(updated as Product)
      toast({ title: next === 'published' ? 'Product published' : 'Product unpublished' })
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20"><Spinner /></div>
    )
  }

  if (!product) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Product not found.</p>
        <Button variant="link" className="mt-2 p-0" onClick={() => navigate('/products')}>
          Back to products
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={product.name}
        description={
          <span className="flex items-center gap-2">
            <Badge variant={statusVariant[product.status]} className="capitalize">
              {product.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Base price: {product.base_price.toFixed(2)} {product.currency}
            </span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={product.status === 'published' ? 'outline' : 'default'}
              onClick={handleTogglePublish}
            >
              {product.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        }
      />

      {/* Back link */}
      <div className="px-6 pt-4">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All products
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b">
          {(['details', 'characteristics', 'rules', 'formulas', 'visualization', 'embed'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6 max-w-2xl">
        {activeTab === 'details' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product details</CardTitle>
              <CardDescription>Update the product name, description, and pricing.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductForm
                defaultValues={productToFormValues(product)}
                onSubmit={handleSaveDetails}
                submitLabel="Save changes"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'characteristics' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Characteristics & options</CardTitle>
              <CardDescription>
                Define what customers can configure. Each characteristic has selectable values
                with optional price modifiers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CharacteristicsPanel productId={product.id} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'rules' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration rules</CardTitle>
              <CardDescription>
                Automatically hide, disable, lock, or set values based on other selections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RulesPanel productId={product.id} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'formulas' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formula pricing</CardTitle>
              <CardDescription>
                Build custom pricing rules that calculate surcharges or discounts based on the configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormulaPanel productId={product.id} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'visualization' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visualization assets</CardTitle>
              <CardDescription>
                Upload or link images and renders. Attach them to specific option values
                so the product visual updates as customers configure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VisualizationPanel productId={product.id} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'embed' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Embed & share</CardTitle>
              <CardDescription>
                Get the embed code to place the configurator on your website.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmbedPanel product={product} />
            </CardContent>
          </Card>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
