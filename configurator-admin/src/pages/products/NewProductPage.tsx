import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createProduct } from '@/lib/products'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProductForm, type ProductFormValues } from './components/ProductForm'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

interface Template {
  id: string
  name: string
  description: string | null
  base_price: number
  currency: string
  template_category: string | null
}

const CATEGORY_ORDER = ['Furniture', 'Windows & Doors']

export function NewProductPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const [tab, setTab] = useState('template')

  // Templates
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [cloningId, setCloningId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, description, base_price, currency, template_category')
      .eq('is_template', true)
      .eq('status', 'published')
      .order('template_category', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        setTemplates((data ?? []) as Template[])
        setLoadingTemplates(false)
      })
  }, [])

  async function handleClone(templateId: string) {
    setCloningId(templateId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('clone-template', {
        body: { template_id: templateId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const { product_id } = res.data as { product_id: string }
      navigate(`/products/${product_id}/edit`, { replace: true })
    } catch (e) {
      toast({
        title: t('Failed to clone template'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
      setCloningId(null)
    }
  }

  async function handleSubmit(values: ProductFormValues) {
    try {
      const product = await createProduct({
        name:            values.name,
        description:     values.description ?? null,
        base_price:      values.base_price,
        currency:        values.currency,
        sku:             values.sku?.trim() || null,
        unit_of_measure: values.unit_of_measure?.trim() || null,
      })
      navigate(`/products/${product.id}/edit`, { replace: true })
    } catch (e) {
      toast({
        title: t('Failed to create product'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  // Group templates by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Template[]>>((acc, cat) => {
    acc[cat] = templates.filter(t => t.template_category === cat)
    return acc
  }, {})
  const otherTemplates = templates.filter(t => !CATEGORY_ORDER.includes(t.template_category ?? ''))

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('New product')}
        description={t('Start from a template or build from scratch.')}
      />

      <div className="px-6 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="template">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              {t('From template')}
            </TabsTrigger>
            <TabsTrigger value="scratch">{t('From scratch')}</TabsTrigger>
          </TabsList>

          {/* ── Template picker ─────────────────────────────────────────────── */}
          <TabsContent value="template" className="mt-4">
            {loadingTemplates ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('No templates available.')}</p>
            ) : (
              <div className="space-y-6 max-w-3xl">
                {[...CATEGORY_ORDER, otherTemplates.length > 0 ? 'Other' : null]
                  .filter(Boolean)
                  .map(cat => {
                    const items = cat === 'Other' ? otherTemplates : (grouped[cat!] ?? [])
                    if (items.length === 0) return null
                    return (
                      <div key={cat}>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{cat}</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {items.map(tmpl => (
                            <Card key={tmpl.id} className="flex flex-col">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">{tmpl.name}</CardTitle>
                                {tmpl.description && (
                                  <CardDescription className="text-xs line-clamp-2">{tmpl.description}</CardDescription>
                                )}
                              </CardHeader>
                              <CardContent className="mt-auto pt-0 flex items-center justify-between">
                                <Badge variant="outline" className="text-xs">
                                  {t('From')} {tmpl.base_price.toFixed(0)} {tmpl.currency}
                                </Badge>
                                <Button
                                  size="sm"
                                  loading={cloningId === tmpl.id}
                                  disabled={!!cloningId}
                                  onClick={() => handleClone(tmpl.id)}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                                  {t('Use')}
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </TabsContent>

          {/* ── From scratch ────────────────────────────────────────────────── */}
          <TabsContent value="scratch" className="mt-4 max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('Product details')}</CardTitle>
                <CardDescription>{t('You can add characteristics and options after saving.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductForm
                  onSubmit={handleSubmit}
                  submitLabel={t('Create product')}
                  onCancel={() => navigate('/products')}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
