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
import { TextsPanel } from './components/TextsPanel'
import { FormConfigPanel, type FormConfig } from './components/FormConfigPanel'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

type Tab = 'details' | 'characteristics' | 'rules' | 'formulas' | 'visualization' | 'form' | 'embed' | 'texts'

const TAB_KEYS: Tab[] = ['details', 'characteristics', 'rules', 'formulas', 'visualization', 'form', 'embed', 'texts']

const TAB_LABELS: Record<Tab, string> = {
  details:         'Details',
  characteristics: 'Characteristics',
  rules:           'Rules',
  formulas:        'Formula pricing',
  visualization:   'Visualization',
  form:            'Form',
  embed:           'Embed',
  texts:           'Texts',
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
      .catch(() => toast({ title: t('Product not found'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSaveDetails(values: ProductFormValues) {
    if (!product) return
    try {
      const updated = await updateProduct(product.id, {
        name:             values.name,
        name_i18n:        values.name_i18n,
        description:      values.description ?? null,
        description_i18n: values.description_i18n,
        base_price:       values.base_price,
        currency:         values.currency,
        sku:              values.sku?.trim() || null,
        unit_of_measure:  values.unit_of_measure?.trim() || null,
      })
      setProduct(updated as Product)
      toast({ title: t('Product saved') })
    } catch (e) {
      toast({
        title: t('Failed to save product'),
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
      toast({ title: next === 'published' ? t('Product published') : t('Product unpublished') })
    } catch {
      toast({ title: t('Failed to update status'), variant: 'destructive' })
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
        <p className="text-sm text-muted-foreground">{t('Product not found.')}</p>
        <Button variant="link" className="mt-2 p-0" onClick={() => navigate('/products')}>
          {t('Back to products')}
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
              {t(product.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t('Base price')}: {product.base_price.toFixed(2)} {product.currency}
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
              {product.status === 'published' ? t('Unpublish') : t('Publish')}
            </Button>
          </div>
        }
      />

      {/* Back link */}
      <div className="px-4 pt-4 md:px-6">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('All products')}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 md:px-6">
        <div className="overflow-x-auto">
          <div className="flex gap-1 border-b min-w-max">
            {TAB_KEYS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(TAB_LABELS[tab])}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 max-w-2xl md:p-6">
        {activeTab === 'details' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Product details')}</CardTitle>
              <CardDescription>{t('Update the product name, description, and pricing.')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductForm
                defaultValues={productToFormValues(product)}
                onSubmit={handleSaveDetails}
                submitLabel={t('Save changes')}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'characteristics' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Characteristics & options')}</CardTitle>
              <CardDescription>
                {t('Define what customers can configure. Each characteristic has selectable values with optional price modifiers.')}
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
              <CardTitle className="text-base">{t('Configuration rules')}</CardTitle>
              <CardDescription>
                {t('Automatically hide, disable, lock, or set values based on other selections.')}
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
              <CardTitle className="text-base">{t('Formula pricing')}</CardTitle>
              <CardDescription>
                {t('Build custom pricing rules that calculate surcharges or discounts based on the configuration.')}
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
              <CardTitle className="text-base">{t('Visualization assets')}</CardTitle>
              <CardDescription>
                {t('Upload or link images and renders. Attach them to specific option values so the product visual updates as customers configure.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VisualizationPanel
                productId={product.id}
                arEnabled={product.ar_enabled}
                onArToggle={async (v) => {
                  const updated = await updateProduct(product.id, { ar_enabled: v })
                  setProduct(updated as Product)
                }}
                arPlacement={product.ar_placement ?? 'floor'}
                onArPlacementChange={async (p) => {
                  const updated = await updateProduct(product.id, { ar_placement: p })
                  setProduct(updated as Product)
                }}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Inquiry form')}</CardTitle>
              <CardDescription>
                {t('Configure the lead-capture form shown to customers, including optional fields and GDPR consent.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormConfigPanel
                productId={product.id}
                initialConfig={(product.form_config as FormConfig | null) ?? {}}
                onSaved={(cfg) => setProduct(p => p ? { ...p, form_config: cfg as unknown as import('@/types/database').Json } : p)}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'embed' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Embed & share')}</CardTitle>
              <CardDescription>
                {t('Get the embed code to place the configurator on your website.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmbedPanel product={product} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'texts' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Product Texts')}</CardTitle>
              <CardDescription>
                {t('Named text blocks included in PDF quotations. Use these for product descriptions, specifications, or terms.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TextsPanel productId={product.id} />
            </CardContent>
          </Card>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
