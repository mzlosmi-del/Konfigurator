import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Layers, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  createProduct,
  createClass,
  createCharacteristic,
  addCharacteristicToClass,
  attachClassToProduct,
  createCharacteristicValue,
} from '@/lib/products'
import { useAuthContext } from '@/components/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProductForm, buildI18nMap, type ProductFormValues } from './components/ProductForm'
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

interface AiCharValue { label: string; price_modifier: number }
interface AiChar      { name: string; display_type: string; is_required: boolean; values: AiCharValue[] }
interface AiProduct   { name: string; description: string; base_price: number; currency: string; characteristics: AiChar[] }

const CATEGORY_ORDER = ['Furniture', 'Windows & Doors']

const VERTICALS = [
  { value: '',         label: t('— select vertical —') },
  { value: 'furniture', label: t('Furniture') },
  { value: 'windows',   label: t('Windows') },
  { value: 'doors',     label: t('Doors') },
  { value: 'other',     label: t('Other') },
]

export function NewProductPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const { tenant, planLimits } = useAuthContext()
  const [tab, setTab] = useState('template')

  // Templates
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [cloningId, setCloningId] = useState<string | null>(null)

  // AI tab state
  const [aiDescription, setAiDescription] = useState('')
  const [aiVertical, setAiVertical]       = useState('')
  const [generating, setGenerating]       = useState(false)
  const [aiResult, setAiResult]           = useState<AiProduct | null>(null)
  const [saving, setSaving]               = useState(false)
  const [expandedChars, setExpandedChars] = useState<Record<number, boolean>>({})

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
        name:             values.name,
        name_i18n:        buildI18nMap(values.name_en, values.name_sr),
        description:      values.description ?? null,
        description_i18n: buildI18nMap(values.description_en, values.description_sr),
        base_price:       values.base_price,
        currency:         values.currency,
        sku:              values.sku?.trim() || null,
        unit_of_measure:  values.unit_of_measure?.trim() || null,
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

  async function handleGenerate() {
    if (!aiDescription.trim()) return
    setGenerating(true)
    setAiResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('ai-product-setup', {
        body: { description: aiDescription, vertical: aiVertical || undefined },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const data = res.data as AiProduct
      setAiResult(data)
      setExpandedChars(Object.fromEntries(data.characteristics.map((_, i) => [i, false])))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      toast({
        title: msg.includes('plan_limit') ? t('Plan limit reached') : t('Generation failed'),
        description: msg.includes('plan_limit')
          ? t('Upgrade your plan to use AI product setup.')
          : msg || undefined,
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveAi() {
    if (!aiResult || !tenant) return
    setSaving(true)
    try {
      const product = await createProduct({
        name:        aiResult.name,
        description: aiResult.description || null,
        base_price:  aiResult.base_price,
        currency:    aiResult.currency,
      })

      for (let i = 0; i < aiResult.characteristics.length; i++) {
        const ch = aiResult.characteristics[i]
        const cls  = await createClass({ name: ch.name })
        const char = await createCharacteristic({ name: ch.name, display_type: ch.display_type as import('@/types/database').DisplayType })
        await addCharacteristicToClass(cls.id, char.id)
        await attachClassToProduct(product.id, cls.id, i)

        for (let j = 0; j < ch.values.length; j++) {
          const v = ch.values[j]
          await createCharacteristicValue({
            characteristic_id: char.id,
            tenant_id:         tenant.id,
            label:             v.label,
            price_modifier:    v.price_modifier,
            sort_order:        j,
          })
        }
      }

      navigate(`/products/${product.id}/edit`, { replace: true })
    } catch (e) {
      toast({
        title: t('Failed to save product'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  // Group templates by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Template[]>>((acc, cat) => {
    acc[cat] = templates.filter(t => t.template_category === cat)
    return acc
  }, {})
  const otherTemplates = templates.filter(t => !CATEGORY_ORDER.includes(t.template_category ?? ''))

  const aiAllowed = (planLimits?.ai_setup_per_month ?? 0) !== 0

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
            <TabsTrigger value="ai">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t('From description')}
            </TabsTrigger>
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

          {/* ── From description (AI) ───────────────────────────────────────── */}
          <TabsContent value="ai" className="mt-4 max-w-xl">
            {/* Coming soon — remove this card and change false→true below to activate */}
            <Card>
              <CardContent className="pt-8 pb-8 text-center space-y-3">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">{t('AI product setup')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('Coming soon. This feature is under development.')}
                </p>
              </CardContent>
            </Card>
            {false && !aiAllowed ? (
              <Card>
                <CardContent className="pt-6 text-center space-y-3">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">{t('AI product setup')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('AI product setup is available on Starter and higher plans.')}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/settings?tab=billing')}>
                    {t('Upgrade plan')}
                  </Button>
                </CardContent>
              </Card>
            ) : aiResult ? (
              /* ── Preview card ── */
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <input
                          className="w-full text-base font-semibold bg-transparent border-0 border-b border-transparent hover:border-border focus:border-border outline-none py-0.5 transition-colors"
                          value={aiResult.name}
                          onChange={e => setAiResult(r => r ? { ...r, name: e.target.value } : r)}
                        />
                        <textarea
                          rows={2}
                          className="w-full text-sm text-muted-foreground bg-transparent border-0 border-b border-transparent hover:border-border focus:border-border outline-none resize-none py-0.5 transition-colors"
                          value={aiResult.description}
                          onChange={e => setAiResult(r => r ? { ...r, description: e.target.value } : r)}
                        />
                      </div>
                      <Badge variant="secondary" className="shrink-0 mt-1">
                        {t('From')} {aiResult.base_price} {aiResult.currency}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      {t('Characteristics')} ({aiResult.characteristics.length})
                    </p>
                    {aiResult.characteristics.map((ch, i) => (
                      <div key={i} className="border rounded-md overflow-hidden">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedChars(p => ({ ...p, [i]: !p[i] }))}
                        >
                          <span>{ch.name}</span>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-xs">{ch.values.length} {t('values')}</span>
                            {expandedChars[i] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </button>
                        {expandedChars[i] && (
                          <div className="border-t px-3 py-2 space-y-1 bg-muted/20">
                            {ch.values.map((v, j) => (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <span>{v.label}</span>
                                {v.price_modifier !== 0 && (
                                  <span className="text-muted-foreground">+{v.price_modifier}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    loading={saving}
                    onClick={handleSaveAi}
                  >
                    {t('Save product')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setAiResult(null)}
                  >
                    {t('Regenerate')}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Input form ── */
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t('Describe your product')}
                  </CardTitle>
                  <CardDescription>
                    {t('Claude will generate a configurable product structure from your description.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('Product description')}</label>
                    <textarea
                      rows={5}
                      placeholder={t('e.g. A custom wooden desk available in three widths with a choice of solid oak or walnut surface and metal or wood legs...')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      value={aiDescription}
                      onChange={e => setAiDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('Vertical')} <span className="text-muted-foreground font-normal">({t('optional')})</span></label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={aiVertical}
                      onChange={e => setAiVertical(e.target.value)}
                    >
                      {VERTICALS.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  {generating ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <Spinner />
                      <p className="text-sm text-muted-foreground">{t('Generating product structure…')}</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1"
                        disabled={!aiDescription.trim()}
                        onClick={handleGenerate}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        {t('Generate')}
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/products')}>{t('Cancel')}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
