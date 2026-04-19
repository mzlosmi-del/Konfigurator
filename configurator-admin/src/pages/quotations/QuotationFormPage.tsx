import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, FileText, Settings2 } from 'lucide-react'
import {
  fetchQuotation,
  createQuotation,
  updateQuotation,
  uploadQuotationPdf,
  calcSubtotal,
  calcTotal,
  generateReferenceNumber,
} from '@/lib/quotations'
import {
  fetchProducts,
  fetchProductCharacteristicsWithValues,
} from '@/lib/products'
import { evaluateRules } from '@/lib/configurationRules'
import { buildQuotationPdfBytes, openPdfBlob, type TenantProfile } from '@/lib/quotationPdf'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type {
  Product,
  Json,
  QuotationLineItem,
  QuotationAdjustment,
  AdjustmentType,
  QuotationConfigItem,
  ConfigurationRule,
} from '@/types/database'
import type { CharacteristicWithValues } from '@/lib/products'
import { ConfigureProductDialog } from './ConfigureProductDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

// ── Internal draft types ──────────────────────────────────────────────────────

interface LineItemDraft {
  product_id: string
  quantity:   number
  selection:  Record<string, string>  // charId → valueId
}

interface AdjustmentDraft {
  type:  AdjustmentType
  label: string
  mode:  'percent' | 'fixed'
  value: string
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'RSD']

const ADJ_TYPE_LABELS: Record<AdjustmentType, string> = {
  surcharge: 'Surcharge',
  discount:  'Discount',
  tax:       'Tax',
}

function defaultExpiry(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

// ── Component ──────────────────────────────────────────────────────────────────

export function QuotationFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit  = Boolean(id)
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const { tenant } = useAuthContext()

  // ── Data ───────────────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(isEdit)
  const [products, setProducts] = useState<Product[]>([])
  const [detailsCache, setDetailsCache] = useState<Record<string, CharacteristicWithValues[]>>({})
  const [rulesCache,   setRulesCache]   = useState<Record<string, ConfigurationRule[]>>({})

  // ── Customer fields ────────────────────────────────────────────────────────
  const [customerName,    setCustomerName]    = useState('')
  const [customerEmail,   setCustomerEmail]   = useState('')
  const [customerCompany, setCustomerCompany] = useState('')
  const [customerPhone,   setCustomerPhone]   = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  // ── Quote meta ─────────────────────────────────────────────────────────────
  const [validUntil, setValidUntil] = useState(defaultExpiry())
  const [currency,   setCurrency]   = useState('EUR')
  const [notes,      setNotes]      = useState('')

  // ── Line items ─────────────────────────────────────────────────────────────
  const [lineItems,   setLineItems]   = useState<LineItemDraft[]>([])
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>([])

  // ── Saving state ───────────────────────────────────────────────────────────
  const [saving,        setSaving]        = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [savingPdf,     setSavingPdf]     = useState(false)
  const [pendingSave,   setPendingSave]   = useState<{ bytes: Uint8Array; quotationId: string; tenantId: string } | null>(null)

  // ── Load products + (in edit mode) existing quotation ─────────────────────
  useEffect(() => {
    fetchProducts()
      .then(ps => setProducts(ps.filter(p => p.status === 'published')))
      .catch(() => toast({ title: t('Failed to load products'), variant: 'destructive' }))
  }, [])

  useEffect(() => {
    if (!isEdit || !id) return
    setPageLoading(true)
    fetchQuotation(id)
      .then(async q => {
        setCustomerName(q.customer_name)
        setCustomerEmail(q.customer_email)
        setCustomerCompany(q.customer_company ?? '')
        setCustomerPhone(q.customer_phone ?? '')
        setCustomerAddress(q.customer_address ?? '')
        setValidUntil(q.valid_until ?? defaultExpiry())
        setCurrency(q.currency)
        setNotes(q.notes ?? '')

        const items = (Array.isArray(q.line_items) ? q.line_items : []) as unknown as QuotationLineItem[]
        const adjs  = (Array.isArray(q.adjustments) ? q.adjustments : []) as unknown as QuotationAdjustment[]

        // Build details + rules cache for all products in this quotation
        const uniqueIds = [...new Set(items.map(i => i.product_id))]
        await Promise.all(uniqueIds.map(pid => ensureProductData(pid)))

        setLineItems(items.map(item => ({
          product_id: item.product_id,
          quantity:   item.quantity,
          selection:  Object.fromEntries(
            item.configuration.map(c => [c.characteristic_id, c.value_id])
          ),
        })))

        setAdjustments(adjs.map(a => ({
          type:  a.type,
          label: a.label,
          mode:  a.mode,
          value: String(a.value),
        })))
      })
      .catch(() => toast({ title: t('Failed to load quotation'), variant: 'destructive' }))
      .finally(() => setPageLoading(false))
  }, [id])

  // ── Load product details + rules on demand ─────────────────────────────────
  const ensureProductData = useCallback(async (productId: string) => {
    if (!productId) return
    const needDetails = !detailsCache[productId]
    const needRules   = !rulesCache[productId]
    if (!needDetails && !needRules) return
    try {
      const [details, rulesData] = await Promise.all([
        needDetails ? fetchProductCharacteristicsWithValues(productId) : Promise.resolve(detailsCache[productId]),
        needRules   ? supabase.from('configuration_rules').select('*').eq('product_id', productId).eq('is_active', true) : Promise.resolve({ data: rulesCache[productId] }),
      ])
      setDetailsCache(prev => ({ ...prev, [productId]: details }))
      setRulesCache(prev  => ({ ...prev, [productId]: ((rulesData as any).data ?? []) as ConfigurationRule[] }))
    } catch {
      toast({ title: t('Failed to load product details'), variant: 'destructive' })
    }
  }, [detailsCache, rulesCache])

  // ── Line item helpers ───────────────────────────────────────────────────────
  function addLineItem() {
    setLineItems(prev => [...prev, { product_id: '', quantity: 1, selection: {} }])
  }

  function removeLineItem(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  async function handleProductChange(index: number, productId: string) {
    updateLineItem(index, { product_id: productId, selection: {} })
    if (productId) await ensureProductData(productId)
  }

  // ── Adjustment helpers ─────────────────────────────────────────────────────
  function addAdjustment() {
    setAdjustments(prev => [...prev, { type: 'tax', label: '', mode: 'percent', value: '' }])
  }

  function removeAdjustment(index: number) {
    setAdjustments(prev => prev.filter((_, i) => i !== index))
  }

  function updateAdjustment(index: number, patch: Partial<AdjustmentDraft>) {
    setAdjustments(prev => prev.map((a, i) => i === index ? { ...a, ...patch } : a))
  }

  // ── Price calculation ──────────────────────────────────────────────────────
  function buildLineItemData(): QuotationLineItem[] {
    return lineItems
      .filter(li => li.product_id)
      .map(li => {
        const product    = products.find(p => p.id === li.product_id)
        const chars      = detailsCache[li.product_id] ?? []
        const rules      = rulesCache[li.product_id]   ?? []
        const ruleEffect = evaluateRules(rules, li.selection)
        const config: QuotationConfigItem[] = []
        let   unitPrice = Number(product?.base_price ?? 0)

        for (const char of chars) {
          const valueId = li.selection[char.id]
          if (!valueId) continue
          const value = char.characteristic_values.find(v => v.id === valueId)
          if (!value) continue
          const effective = ruleEffect.priceOverrides[value.id] ?? Number(value.price_modifier)
          config.push({
            characteristic_id:   char.id,
            characteristic_name: char.name,
            value_id:            value.id,
            value_label:         value.label,
            price_modifier:      effective,
          })
          unitPrice += effective
        }

        return {
          product_id:      li.product_id,
          product_name:    product?.name ?? '',
          product_sku:     product?.sku ?? null,
          unit_of_measure: product?.unit_of_measure ?? null,
          quantity:        li.quantity,
          unit_price:      Math.max(0, unitPrice),
          configuration:   config,
        }
      })
  }

  function buildAdjustmentData(): QuotationAdjustment[] {
    return adjustments
      .filter(a => a.label.trim())
      .map(a => ({
        type:  a.type,
        label: a.label.trim(),
        mode:  a.mode,
        value: parseFloat(a.value) || 0,
      }))
  }

  const builtItems = buildLineItemData()
  const builtAdjs  = buildAdjustmentData()
  const subtotal   = calcSubtotal(builtItems)
  const total      = calcTotal(subtotal, builtAdjs)

  function computeAdjDisplayAmount(adj: QuotationAdjustment, runningBefore: number): number {
    const amount = adj.mode === 'percent' ? (runningBefore * adj.value) / 100 : adj.value
    return adj.type === 'discount' ? -amount : amount
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  function validate(): boolean {
    if (!customerName.trim()) {
      toast({ title: t('Customer name is required'), variant: 'destructive' })
      return false
    }
    if (!customerEmail.trim()) {
      toast({ title: t('Customer email is required'), variant: 'destructive' })
      return false
    }
    if (lineItems.some(li => !li.product_id)) {
      toast({ title: t('All line items must have a product selected'), variant: 'destructive' })
      return false
    }
    return true
  }

  async function doSave(status: 'in_preparation' | 'confirmed_sent' = 'in_preparation'): Promise<string | null> {
    if (!validate()) return null
    setSaving(true)
    try {
      const items = buildLineItemData()
      const adjs  = buildAdjustmentData()
      const sub   = calcSubtotal(items)
      const tot   = calcTotal(sub, adjs)

      const payload = {
        customer_name:    customerName.trim(),
        customer_email:   customerEmail.trim(),
        customer_company: customerCompany.trim() || null,
        customer_phone:   customerPhone.trim()   || null,
        customer_address: customerAddress.trim() || null,
        notes:            notes.trim()            || null,
        valid_until:      validUntil              || null,
        currency,
        subtotal:         sub,
        total_price:      tot,
        status,
        line_items:       items as unknown as Json,
        adjustments:      adjs  as unknown as Json,
      }

      if (isEdit && id) {
        await updateQuotation(id, payload)
        return id
      } else {
        const q = await createQuotation({
          ...payload,
          reference_number: generateReferenceNumber(),
          pdf_url:             null,
          rejection_reason_id: null,
          rejection_note:      null,
        })
        return q.id
      }
    } catch (err) {
      toast({ title: t('Failed to save quotation'), description: String(err), variant: 'destructive' })
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDraft() {
    const savedId = await doSave('in_preparation')
    if (savedId) navigate(`/quotations/${savedId}`)
  }

  async function handleSaveAndPdf() {
    const savedId = await doSave('confirmed_sent')
    if (!savedId) return
    setGeneratingPdf(true)
    try {
      const savedQuotation = await fetchQuotation(savedId)
      const tenantProfile: TenantProfile = {
        name:            tenant?.name            ?? 'Your store',
        logo_url:        (tenant as any)?.logo_url,
        company_address: (tenant as any)?.company_address,
        company_phone:   (tenant as any)?.company_phone,
        company_email:   (tenant as any)?.company_email,
        company_website: (tenant as any)?.company_website,
        contact_person:  (tenant as any)?.contact_person,
      }
      const bytes = await buildQuotationPdfBytes(tenantProfile, savedQuotation)
      openPdfBlob(bytes)
      setPendingSave({ bytes, quotationId: savedId, tenantId: savedQuotation.tenant_id })
    } catch (err) {
      toast({ title: t('Failed to generate PDF'), description: String(err), variant: 'destructive' })
      navigate(`/quotations/${savedId}`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleConfirmSavePdf() {
    if (!pendingSave) return
    setSavingPdf(true)
    try {
      await uploadQuotationPdf(pendingSave.quotationId, pendingSave.tenantId, pendingSave.bytes)
      toast({ title: t('PDF saved to cloud') })
    } catch (err) {
      toast({ title: t('Failed to save PDF'), description: String(err), variant: 'destructive' })
    } finally {
      setSavingPdf(false)
      navigate(`/quotations/${pendingSave.quotationId}`)
      setPendingSave(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={t('Edit Quotation')} />
        <div className="flex justify-center py-16"><Spinner /></div>
      </div>
    )
  }

  const isBusy = saving || generatingPdf

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={isEdit ? t('Edit Quotation') : t('New Quotation')}
        description={
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate('/quotations')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Back to Quotations')}
          </button>
        }
      />

      <div className="p-6 space-y-6 max-w-4xl">

        {/* ── Customer ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Customer')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Name')} *</label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('Customer name')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Email')} *</label>
              <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Company')}</label>
              <Input value={customerCompany} onChange={e => setCustomerCompany(e.target.value)} placeholder={t('Company name')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Phone')}</label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+1 234 567 890" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">{t('Address')}</label>
              <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder={t('Street, city, country')} />
            </div>
          </CardContent>
        </Card>

        {/* ── Quote meta ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Quote Details')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Valid Until')}</label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Currency')}</label>
              <Select value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">{t('Notes')}</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('Internal notes or terms…')} rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* ── Line items ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Line Items')}</CardTitle>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-1" />
              {t('Add line item')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('No line items yet. Add a product to get started.')}
              </p>
            )}
            {lineItems.map((item, idx) => (
              <LineItemRow
                key={idx}
                item={item}
                products={products}
                details={detailsCache[item.product_id] ?? []}
                rules={rulesCache[item.product_id] ?? []}
                currency={currency}
                onProductChange={pid => handleProductChange(idx, pid)}
                onQtyChange={qty => updateLineItem(idx, { quantity: qty })}
                onSelectionChange={sel => updateLineItem(idx, { selection: sel })}
                onRemove={() => removeLineItem(idx)}
              />
            ))}
          </CardContent>
        </Card>

        {/* ── Adjustments ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Surcharges, Discounts & Taxes')}</CardTitle>
            <Button variant="outline" size="sm" onClick={addAdjustment}>
              <Plus className="h-4 w-4 mr-1" />
              {t('Add adjustment')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {adjustments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('No adjustments. Add tax, surcharges, or discounts.')}
              </p>
            )}
            {adjustments.map((adj, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={adj.type} onChange={e => updateAdjustment(idx, { type: e.target.value as AdjustmentType })} className="w-32">
                  {(Object.keys(ADJ_TYPE_LABELS) as AdjustmentType[]).map(k => (
                    <option key={k} value={k}>{t(ADJ_TYPE_LABELS[k])}</option>
                  ))}
                </Select>
                <Input value={adj.label} onChange={e => updateAdjustment(idx, { label: e.target.value })} placeholder={t('Label (e.g. VAT 20%)')} className="flex-1" />
                <Select value={adj.mode} onChange={e => updateAdjustment(idx, { mode: e.target.value as 'percent' | 'fixed' })} className="w-24">
                  <option value="percent">%</option>
                  <option value="fixed">{currency}</option>
                </Select>
                <Input
                  type="number" min="0" step="0.01"
                  value={adj.value} onChange={e => updateAdjustment(idx, { value: e.target.value })}
                  className="w-28 text-right" placeholder="0"
                />
                <Button variant="ghost" size="icon" onClick={() => removeAdjustment(idx)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Price summary ─────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 border rounded-lg p-4 bg-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Subtotal')}</span>
              <span>{subtotal.toFixed(2)} {currency}</span>
            </div>
            {(() => {
              let running = subtotal
              return builtAdjs.map((adj, i) => {
                const amt = computeAdjDisplayAmount(adj, running)
                if (adj.type !== 'discount') running += Math.abs(amt)
                else running -= Math.abs(amt)
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate pr-2">{adj.label}</span>
                    <span className={amt >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {amt >= 0 ? '+' : ''}{amt.toFixed(2)} {currency}
                    </span>
                  </div>
                )
              })
            })()}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{t('Total')}</span>
              <span className="text-lg">{total.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={() => navigate('/quotations')} disabled={isBusy}>
            {t('Cancel')}
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={isBusy} loading={saving && !generatingPdf}>
            {t('Save Draft')}
          </Button>
          <Button onClick={handleSaveAndPdf} disabled={isBusy} loading={generatingPdf}>
            <FileText className="h-4 w-4 mr-1.5" />
            {t('Save & Generate PDF')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingSave}
        onOpenChange={open => { if (!open) { navigate(`/quotations/${pendingSave?.quotationId}`); setPendingSave(null) } }}
        title={t('Save PDF to cloud?')}
        description={t('The PDF will be stored in Supabase storage and a permanent download link will be attached to this quotation.')}
        confirmLabel={t('Save PDF')}
        onConfirm={handleConfirmSavePdf}
        loading={savingPdf}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── LineItemRow sub-component ──────────────────────────────────────────────────

interface LineItemRowProps {
  item:              LineItemDraft
  products:          Product[]
  details:           CharacteristicWithValues[]
  rules:             ConfigurationRule[]
  currency:          string
  onProductChange:   (pid: string) => void
  onQtyChange:       (qty: number) => void
  onSelectionChange: (sel: Record<string, string>) => void
  onRemove:          () => void
}

function LineItemRow({
  item, products, details, rules, currency,
  onProductChange, onQtyChange, onSelectionChange, onRemove,
}: LineItemRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const product = products.find(p => p.id === item.product_id)

  // Compute current unit price from selection (respecting price_override rules)
  const lineRuleEffect = evaluateRules(rules, item.selection)
  let unitPrice = Number(product?.base_price ?? 0)
  for (const char of details) {
    const valueId = item.selection[char.id]
    if (!valueId) continue
    const v = char.characteristic_values.find(v => v.id === valueId)
    if (!v) continue
    unitPrice += lineRuleEffect.priceOverrides[v.id] ?? Number(v.price_modifier)
  }
  unitPrice = Math.max(0, unitPrice)

  const configuredCount = Object.keys(item.selection).length
  const hasCharacteristics = details.length > 0

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Product selector */}
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t('Product')}</label>
          <Select value={item.product_id} onChange={e => onProductChange(e.target.value)}>
            <option value="">{t('Select a product…')}</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
            ))}
          </Select>
        </div>

        {/* Quantity */}
        <div className="w-24 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t('Qty')}</label>
          <Input
            type="number" min="1" step="1"
            value={item.quantity}
            onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="text-center"
          />
        </div>

        {/* Unit price (read-only) */}
        <div className="w-36 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t('Unit Price')}</label>
          <Input
            value={product ? `${unitPrice.toFixed(2)}${product.unit_of_measure ? ' / ' + product.unit_of_measure : ''}` : '—'}
            readOnly
            className="bg-muted/30 text-right"
          />
        </div>

        {/* Remove */}
        <div className="pt-6">
          <Button variant="ghost" size="icon" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Configure button + summary chips */}
      {item.product_id && hasCharacteristics && (
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            {configuredCount > 0 ? t('Reconfigure') : t('Configure')}
          </Button>

          {configuredCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {details
                .filter(char => item.selection[char.id])
                .map(char => {
                  const val = char.characteristic_values.find(v => v.id === item.selection[char.id])
                  return val ? (
                    <span key={char.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-muted/50">
                      <span className="text-muted-foreground">{char.name}:</span>
                      <span className="font-medium">{val.label}</span>
                    </span>
                  ) : null
                })}
            </div>
          )}
        </div>
      )}

      {/* Row total */}
      {item.product_id && (
        <div className="text-right text-sm text-muted-foreground">
          {t('Line total')}: <span className="font-medium text-foreground">{(unitPrice * item.quantity).toFixed(2)} {currency}</span>
        </div>
      )}

      {/* Configure dialog */}
      {item.product_id && hasCharacteristics && (
        <ConfigureProductDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productName={product?.name ?? ''}
          basePrice={product?.base_price ?? 0}
          currency={currency}
          characteristics={details}
          rules={rules}
          initialSelection={item.selection}
          onApply={sel => {
            onSelectionChange(sel)
            setDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}
