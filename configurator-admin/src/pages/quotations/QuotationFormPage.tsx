import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, FileText, Settings2, Inbox, CalendarRange } from 'lucide-react'
import {
  fetchQuotation,
  createQuotation,
  updateQuotation,
  uploadQuotationPdf,
  calcSubtotal,
  calcTotal,
  calcLineTotal,
  generateReferenceNumber,
} from '@/lib/quotations'
import {
  fetchProducts,
  fetchProductCharacteristicsWithValues,
  fetchProductTexts,
  fetchGlobalTexts,
} from '@/lib/products'
import { fetchInquiry } from '@/lib/inquiries'
import { fetchActivePricing, type ActivePricing } from '@/lib/pricing'
import { inquiryToQuotationDraft } from '@/lib/inquiryConversion'
import { evaluateRules } from '@/lib/configurationRules'
import { calculateFormulaTotal, type FormulaContext } from '@/lib/formulaEngine'
import { buildQuotationPdfBytes, openPdfBlob, type TenantProfile } from '@/lib/quotationPdf'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type {
  Product,
  Json,
  QuotationLineItem,
  QuotationAdjustment,
  QuotationConfigItem,
  ConfigurationRule,
  PricingFormula,
  ProductText,
  AdjustmentType,
} from '@/types/database'
import type { CharacteristicWithValues } from '@/lib/products'
import { ConfigureProductDialog } from './ConfigureProductDialog'
import { PdfLayoutDialog, type PdfSection, type ProductTextGroup } from './PdfLayoutDialog'
import { AdjustmentEditor, buildAdjustmentData, adjustmentToDraft, type AdjustmentDraft } from './AdjustmentEditor'
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
  product_id:     string
  quantity:       number
  selection:      Record<string, string>  // charId → valueId
  adjustments:    AdjustmentDraft[]
  price_override: number | null  // active scheduled price, null = use product.base_price
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'RSD']

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
  const [searchParams] = useSearchParams()
  const inquiryIdParam = searchParams.get('inquiry_id')
  const { toasts, toast, dismiss } = useToast()
  const { tenant } = useAuthContext()

  // ── Data ───────────────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(isEdit)
  const [products, setProducts] = useState<Product[]>([])
  const [detailsCache,      setDetailsCache]      = useState<Record<string, CharacteristicWithValues[]>>({})
  const [rulesCache,        setRulesCache]        = useState<Record<string, ConfigurationRule[]>>({})
  const [formulasCache,     setFormulasCache]     = useState<Record<string, PricingFormula[]>>({})
  const [productTextsCache, setProductTextsCache] = useState<Record<string, ProductText[]>>({})
  const [pricingCache,      setPricingCache]      = useState<Record<string, ActivePricing>>({})
  const [globalTexts,       setGlobalTexts]       = useState<ProductText[]>([])
  const [layoutDialogOpen,  setLayoutDialogOpen]  = useState(false)
  const [pendingPdfData,    setPendingPdfData]    = useState<{
    savedId: string
    savedQuotation: Awaited<ReturnType<typeof fetchQuotation>>
    tenantProfile: TenantProfile
  } | null>(null)

  // ── Customer fields ────────────────────────────────────────────────────────
  const [customerName,       setCustomerName]       = useState('')
  const [customerEmail,      setCustomerEmail]      = useState('')
  const [customerCompany,    setCustomerCompany]    = useState('')
  const [customerPhone,      setCustomerPhone]      = useState('')
  const [customerAddress,    setCustomerAddress]    = useState('')
  const [customerVatNumber,  setCustomerVatNumber]  = useState('')
  const [deliveryAddress,    setDeliveryAddress]    = useState('')

  // ── Quote meta ─────────────────────────────────────────────────────────────
  const [title,        setTitle]        = useState('')
  const [validUntil,   setValidUntil]   = useState(defaultExpiry())
  const [currency,     setCurrency]     = useState('EUR')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes,        setNotes]        = useState('')

  // ── Line items ─────────────────────────────────────────────────────────────
  const [lineItems,   setLineItems]   = useState<LineItemDraft[]>([])
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>([])

  // ── Source inquiry (for traceability + auto-mark on save) ──────────────────
  const [sourceInquiryId, setSourceInquiryId] = useState<string | null>(null)
  const [inquiryHydrating, setInquiryHydrating] = useState(false)

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
    fetchGlobalTexts()
      .then(setGlobalTexts)
      .catch(() => {/* non-critical */})
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
        setCustomerVatNumber((q as any).customer_vat_number ?? '')
        setDeliveryAddress((q as any).delivery_address ?? '')
        setTitle((q as any).title ?? '')
        setValidUntil(q.valid_until ?? defaultExpiry())
        setCurrency(q.currency)
        setPaymentTerms((q as any).payment_terms ?? '')
        setNotes(q.notes ?? '')

        const items = (Array.isArray(q.line_items) ? q.line_items : []) as unknown as QuotationLineItem[]
        const adjs  = (Array.isArray(q.adjustments) ? q.adjustments : []) as unknown as QuotationAdjustment[]

        // Build details + rules cache for all products in this quotation
        const uniqueIds = [...new Set(items.map(i => i.product_id))]
        await Promise.all(uniqueIds.map(pid => ensureProductData(pid)))

        setLineItems(items.map(item => ({
          product_id:     item.product_id,
          quantity:        item.quantity,
          selection:       Object.fromEntries(
            item.configuration.map(c => [c.characteristic_id, c.value_id])
          ),
          adjustments:    (item.adjustments ?? []).map(adjustmentToDraft),
          price_override: null,
        })))

        setAdjustments(adjs.map(adjustmentToDraft))
        setSourceInquiryId(q.source_inquiry_id ?? null)
      })
      .catch(() => toast({ title: t('Failed to load quotation'), variant: 'destructive' }))
      .finally(() => setPageLoading(false))
  }, [id])

  // ── Load product details + rules on demand ─────────────────────────────────
  const ensureProductData = useCallback(async (productId: string) => {
    if (!productId) return
    const needDetails  = !detailsCache[productId]
    const needRules    = !rulesCache[productId]
    const needFormulas = !formulasCache[productId]
    const needTexts    = !productTextsCache[productId]
    if (!needDetails && !needRules && !needFormulas && !needTexts) return
    try {
      const [details, rulesData, formulasData, texts] = await Promise.all([
        needDetails  ? fetchProductCharacteristicsWithValues(productId) : Promise.resolve(detailsCache[productId]),
        needRules    ? supabase.from('configuration_rules').select('*').eq('product_id', productId).eq('is_active', true) : Promise.resolve({ data: rulesCache[productId] }),
        needFormulas ? supabase.from('pricing_formulas').select('*').eq('product_id', productId).eq('is_active', true).order('sort_order') : Promise.resolve({ data: formulasCache[productId] }),
        needTexts    ? fetchProductTexts(productId) : Promise.resolve(productTextsCache[productId]),
      ])
      setDetailsCache(prev      => ({ ...prev, [productId]: details }))
      setRulesCache(prev        => ({ ...prev, [productId]: ((rulesData as any).data ?? []) as ConfigurationRule[] }))
      setFormulasCache(prev     => ({ ...prev, [productId]: ((formulasData as any).data ?? []) as PricingFormula[] }))
      setProductTextsCache(prev => ({ ...prev, [productId]: texts }))
    } catch {
      toast({ title: t('Failed to load product details'), variant: 'destructive' })
    }
  }, [detailsCache, rulesCache, formulasCache, productTextsCache])

  // ── Line item helpers ───────────────────────────────────────────────────────
  function addLineItem() {
    setLineItems(prev => [...prev, { product_id: '', quantity: 1, selection: {}, adjustments: [], price_override: null }])
  }

  function removeLineItem(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  async function handleProductChange(index: number, productId: string) {
    updateLineItem(index, { product_id: productId, selection: {}, price_override: null, adjustments: [] })
    if (productId) {
      await ensureProductData(productId)
      try {
        const todayStr = new Date().toISOString().slice(0, 10)
        const pricing = await fetchActivePricing(productId, todayStr)
        setPricingCache(prev => ({ ...prev, [productId]: pricing }))
        const taxDrafts: AdjustmentDraft[] = pricing.taxPresets.map(tp => ({
          type: 'tax' as AdjustmentType,
          label: tp.label,
          mode: 'percent' as const,
          value: String(tp.rate),
        }))
        updateLineItem(index, {
          price_override: pricing.scheduledPrice,
          adjustments:    taxDrafts,
        })
      } catch {
        // non-critical — pricing defaults unavailable
      }
    }
  }

  // ── Inquiry → quotation hydration (new quotations with ?inquiry_id=…) ──────
  useEffect(() => {
    if (isEdit || !inquiryIdParam) return
    let cancelled = false
    setInquiryHydrating(true)
    ;(async () => {
      try {
        const inquiry = await fetchInquiry(inquiryIdParam)
        const { data: prodRow } = await supabase
          .from('products')
          .select('*')
          .eq('id', inquiry.product_id)
          .single()
        if (!prodRow) throw new Error('Source product not found')
        const product = prodRow as Product
        const chars = await fetchProductCharacteristicsWithValues(product.id)
        if (cancelled) return

        const draft = inquiryToQuotationDraft(inquiry, product, chars)

        // Hydrate caches so LineItemRow can compute price + render chips
        setDetailsCache(prev => ({ ...prev, [product.id]: chars }))
        await ensureProductData(product.id)

        setCustomerName(draft.customer_name)
        setCustomerEmail(draft.customer_email)
        setCustomerCompany(draft.customer_company ?? '')
        setCustomerPhone(draft.customer_phone ?? '')
        setCustomerAddress(draft.customer_address ?? '')
        setCurrency(draft.currency)
        setNotes(draft.notes ?? '')
        setLineItems([{ product_id: product.id, quantity: 1, selection: draft.selection, adjustments: [], price_override: null }])
        setSourceInquiryId(draft.source_inquiry_id)

        if (draft.dropped.length > 0) {
          toast({
            title: t('Some options could not be carried over'),
            description: t('The product was edited since the inquiry was submitted.') + ' ' + draft.dropped.join(', '),
            variant: 'destructive',
          })
        }
      } catch (err) {
        if (!cancelled) toast({ title: t('Failed to load inquiry'), description: String(err), variant: 'destructive' })
      } finally {
        if (!cancelled) setInquiryHydrating(false)
      }
    })()
    return () => { cancelled = true }
  }, [isEdit, inquiryIdParam])

  // ── Price calculation ──────────────────────────────────────────────────────
  function buildFormulaCtx(
    characteristics: CharacteristicWithValues[],
    selection: Record<string, string>,
    basePrice: number,
  ): FormulaContext {
    const numericInputs:  Record<string, number> = {}
    const cleanSelection: Record<string, string> = {}
    for (const char of characteristics) {
      if (char.display_type === 'number') {
        numericInputs[char.id] = Number(selection[char.id] ?? 0)
      } else if (selection[char.id]) {
        cleanSelection[char.id] = selection[char.id]
      }
    }
    return { base_price: Number(basePrice), selection: cleanSelection, numericInputs, characteristics }
  }

  function buildLineItemData(): QuotationLineItem[] {
    return lineItems
      .filter(li => li.product_id)
      .map(li => {
        const product    = products.find(p => p.id === li.product_id)
        const chars      = detailsCache[li.product_id]  ?? []
        const rules      = rulesCache[li.product_id]    ?? []
        const formulas   = formulasCache[li.product_id] ?? []
        const ruleEffect = evaluateRules(rules, li.selection)
        const config: QuotationConfigItem[] = []
        let   unitPrice = (li.price_override !== null && li.price_override !== undefined)
          ? Number(li.price_override)
          : Number(product?.base_price ?? 0)
        const modOverrides = pricingCache[li.product_id]?.modifierByValueId ?? {}

        for (const char of chars) {
          if (char.display_type === 'number') {
            const rawVal = li.selection[char.id]
            if (rawVal === undefined || rawVal === '') continue
            config.push({
              characteristic_id:   char.id,
              characteristic_name: char.name,
              value_id:            rawVal,
              value_label:         rawVal,
              price_modifier:      0,
            })
            continue
          }
          const valueId = li.selection[char.id]
          if (!valueId) continue
          const value = char.characteristic_values.find(v => v.id === valueId)
          if (!value) continue
          const effective = ruleEffect.priceOverrides[value.id] ?? modOverrides[value.id] ?? Number(value.price_modifier)
          config.push({
            characteristic_id:   char.id,
            characteristic_name: char.name,
            value_id:            value.id,
            value_label:         value.label,
            price_modifier:      effective,
          })
          unitPrice += effective
        }

        const formulaAdj = calculateFormulaTotal(formulas, buildFormulaCtx(chars, li.selection, product?.base_price ?? 0))
        return {
          product_id:      li.product_id,
          product_name:    product?.name ?? '',
          product_sku:     product?.sku ?? null,
          unit_of_measure: product?.unit_of_measure ?? null,
          quantity:        li.quantity,
          unit_price:      Math.max(0, unitPrice + formulaAdj),
          configuration:   config,
          adjustments:     buildAdjustmentData(li.adjustments),
        }
      })
  }

  const builtItems = buildLineItemData()
  const builtAdjs  = buildAdjustmentData(adjustments)
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
      const adjs  = buildAdjustmentData(adjustments)
      const sub   = calcSubtotal(items)
      const tot   = calcTotal(sub, adjs)

      const payload = {
        customer_name:       customerName.trim(),
        customer_email:      customerEmail.trim(),
        customer_company:    customerCompany.trim()   || null,
        customer_phone:      customerPhone.trim()     || null,
        customer_address:    customerAddress.trim()   || null,
        customer_vat_number: customerVatNumber.trim() || null,
        delivery_address:    deliveryAddress.trim()   || null,
        title:               title.trim()             || null,
        payment_terms:       paymentTerms.trim()      || null,
        notes:               notes.trim()             || null,
        valid_until:         validUntil               || null,
        currency,
        subtotal:            sub,
        total_price:         tot,
        status,
        line_items:          items as unknown as Json,
        adjustments:         adjs  as unknown as Json,
      }

      let savedId: string
      if (isEdit && id) {
        await updateQuotation(id, payload)
        savedId = id
      } else {
        const q = await createQuotation({
          ...payload,
          reference_number: generateReferenceNumber(),
          pdf_url:             null,
          rejection_reason_id: null,
          rejection_note:      null,
          source_inquiry_id:   sourceInquiryId,
        })
        savedId = q.id
      }

      // Best-effort: mark source inquiry as replied. Do not block on failure.
      if (!isEdit && sourceInquiryId) {
        try {
          await supabase.from('inquiries').update({ status: 'replied' } as unknown as never).eq('id', sourceInquiryId)
        } catch (e) {
          console.warn('Failed to mark source inquiry as replied', e)
        }
      }

      return savedId
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
        name:                tenant?.name                ?? 'Your store',
        logo_url:            (tenant as any)?.logo_url,
        company_address:     (tenant as any)?.company_address,
        company_phone:       (tenant as any)?.company_phone,
        company_email:       (tenant as any)?.company_email,
        company_website:     (tenant as any)?.company_website,
        contact_person:      (tenant as any)?.contact_person,
        vat_number:          (tenant as any)?.vat_number,
        company_reg_number:  (tenant as any)?.company_reg_number,
      }
      setPendingPdfData({ savedId, savedQuotation, tenantProfile })
      setLayoutDialogOpen(true)
    } catch (err) {
      toast({ title: t('Failed to save quotation'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleLayoutConfirm(sections: PdfSection[], lang: 'en' | 'sr') {
    if (!pendingPdfData) return
    const { savedId, savedQuotation, tenantProfile } = pendingPdfData
    setGeneratingPdf(true)
    try {
      const enabledPtIds = new Set(
        sections.filter(s => s.productTextId && s.visible).map(s => s.productTextId!)
      )
      const hasPtSections = sections.some(s => s.productTextId !== undefined)
      const pdfProductTexts: Record<string, ProductText[]> = {}
      for (const [pid, texts] of Object.entries(productTextsCache)) {
        const kept = hasPtSections ? texts.filter(pt => enabledPtIds.has(pt.id)) : texts
        if (kept.length) pdfProductTexts[pid] = kept
      }
      const bytes = await buildQuotationPdfBytes(tenantProfile, savedQuotation, pdfProductTexts, globalTexts, sections, lang)
      setLayoutDialogOpen(false)
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

      <div className="p-4 space-y-4 md:p-6 md:space-y-6 max-w-4xl">

        {/* Source inquiry breadcrumb (when present) */}
        {sourceInquiryId && (
          <Link
            to={`/inquiries/${sourceInquiryId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Inbox className="h-3.5 w-3.5" />
            {t('Created from inquiry')} #{sourceInquiryId.slice(0, 8)}
          </Link>
        )}

        {inquiryHydrating && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Spinner /> {t('Loading inquiry…')}
          </div>
        )}

        {/* Source inquiry breadcrumb (when present) */}
        {sourceInquiryId && (
          <Link
            to={`/inquiries/${sourceInquiryId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Inbox className="h-3.5 w-3.5" />
            {t('Created from inquiry')} #{sourceInquiryId.slice(0, 8)}
          </Link>
        )}

        {inquiryHydrating && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Spinner /> {t('Loading inquiry…')}
          </div>
        )}

        {/* ── Customer ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Customer')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">{t('Billing Address')}</label>
              <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder={t('Street, city, country')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('VAT / Tax ID')}</label>
              <Input value={customerVatNumber} onChange={e => setCustomerVatNumber(e.target.value)} placeholder={t('e.g. DE123456789')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Delivery Address')}</label>
              <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder={t('Leave blank if same as billing')} />
            </div>
          </CardContent>
        </Card>

        {/* ── Quote meta ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Quote Details')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">{t('Subject / Title')}</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('e.g. Custom furniture package for office renovation')} />
            </div>
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
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">{t('Payment Terms')}</label>
              <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder={t('e.g. Net 30, 50% upfront')} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
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
                formulas={formulasCache[item.product_id] ?? []}
                currency={currency}
                activePricing={pricingCache[item.product_id]}
                onProductChange={pid => handleProductChange(idx, pid)}
                onQtyChange={qty => updateLineItem(idx, { quantity: qty })}
                onSelectionChange={sel => updateLineItem(idx, { selection: sel })}
                onAdjustmentsChange={adjs => updateLineItem(idx, { adjustments: adjs })}
                onRemove={() => removeLineItem(idx)}
              />
            ))}
          </CardContent>
        </Card>

        {/* ── Adjustments (whole quotation) ────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Surcharges, Discounts & Taxes')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('Applied to the subtotal. For per-item adjustments, use the controls inside each line item.')}
            </p>
          </CardHeader>
          <CardContent>
            <AdjustmentEditor
              adjustments={adjustments}
              currency={currency}
              onChange={setAdjustments}
              emptyText={t('No adjustments. Add tax, surcharges, or discounts.')}
            />
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
        <div className="flex flex-wrap items-center gap-3 pt-2">
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

      <PdfLayoutDialog
        open={layoutDialogOpen}
        onOpenChange={open => {
          setLayoutDialogOpen(open)
          if (!open && pendingPdfData) navigate(`/quotations/${pendingPdfData.savedId}`)
        }}
        globalTexts={globalTexts}
        productTexts={lineItems
          .filter(li => li.product_id && productTextsCache[li.product_id]?.length)
          .reduce<ProductTextGroup[]>((acc, li) => {
            if (acc.some(g => g.productId === li.product_id)) return acc
            const prod = products.find(p => p.id === li.product_id)
            acc.push({
              productId:   li.product_id,
              productName: prod?.name ?? li.product_id,
              texts:       productTextsCache[li.product_id],
            })
            return acc
          }, [])}
        quotationHasNotes={!!notes.trim()}
        onConfirm={handleLayoutConfirm}
        loading={generatingPdf}
        quotation={pendingPdfData?.savedQuotation ?? ({ customer_name: customerName, customer_email: customerEmail, line_items: [], adjustments: [], currency } as unknown as import('@/types/database').Quotation)}
        tenant={pendingPdfData?.tenantProfile ?? { name: tenant?.name ?? 'Your store' }}
      />

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
  item:                LineItemDraft
  products:            Product[]
  details:             CharacteristicWithValues[]
  rules:               ConfigurationRule[]
  formulas:            PricingFormula[]
  currency:            string
  activePricing?:      ActivePricing
  onProductChange:     (pid: string) => void
  onQtyChange:         (qty: number) => void
  onSelectionChange:   (sel: Record<string, string>) => void
  onAdjustmentsChange: (adjs: AdjustmentDraft[]) => void
  onRemove:            () => void
}

function buildFormulaCtxLocal(
  characteristics: CharacteristicWithValues[],
  selection: Record<string, string>,
  basePrice: number,
): FormulaContext {
  const numericInputs:  Record<string, number> = {}
  const cleanSelection: Record<string, string> = {}
  for (const char of characteristics) {
    if (char.display_type === 'number') {
      numericInputs[char.id] = Number(selection[char.id] ?? 0)
    } else if (selection[char.id]) {
      cleanSelection[char.id] = selection[char.id]
    }
  }
  return { base_price: Number(basePrice), selection: cleanSelection, numericInputs, characteristics }
}

function LineItemRow({
  item, products, details, rules, formulas, currency, activePricing,
  onProductChange, onQtyChange, onSelectionChange, onAdjustmentsChange, onRemove,
}: LineItemRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const product = products.find(p => p.id === item.product_id)

  // Compute current unit price from selection (respecting price_override rules + formulas)
  const lineRuleEffect = evaluateRules(rules, item.selection)
  let unitPrice = (item.price_override !== null && item.price_override !== undefined)
    ? Number(item.price_override)
    : Number(product?.base_price ?? 0)
  for (const char of details) {
    if (char.display_type === 'number') continue
    const valueId = item.selection[char.id]
    if (!valueId) continue
    const v = char.characteristic_values.find(v => v.id === valueId)
    if (!v) continue
    unitPrice += lineRuleEffect.priceOverrides[v.id] ?? Number(v.price_modifier)
  }
  unitPrice += calculateFormulaTotal(formulas, buildFormulaCtxLocal(details, item.selection, product?.base_price ?? 0))
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

      {/* Scheduled price indicator */}
      {item.price_override !== null && item.price_override !== undefined && product && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600">
          <CalendarRange className="h-3 w-3" />
          {t('Scheduled price')}: {product.currency} {Number(item.price_override).toFixed(2)}
          <span className="text-muted-foreground">({t('replaces catalogue price')} {product.currency} {Number(product.base_price).toFixed(2)})</span>
        </div>
      )}

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

      {/* Per-item adjustments */}
      {item.product_id && (
        <div className="border-t pt-3 mt-1 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('Item adjustments')}
          </p>
          <AdjustmentEditor
            adjustments={item.adjustments}
            currency={currency}
            onChange={onAdjustmentsChange}
            compact
          />
          {/* Preset adjustment suggestions */}
          {activePricing && activePricing.adjustmentPresets.length > 0 && (() => {
            const suggestions = activePricing.adjustmentPresets.filter(
              preset => !item.adjustments.some(a => a.label === preset.label)
            )
            if (!suggestions.length) return null
            return (
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-1.5">{t('Suggestions')}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const newAdj: AdjustmentDraft = {
                          type:  preset.adjustment_type as AdjustmentType,
                          label: preset.label,
                          mode:  preset.mode,
                          value: String(preset.value),
                        }
                        onAdjustmentsChange([...item.adjustments, newAdj])
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Row total (after item adjustments) */}
      {item.product_id && (() => {
        const base = unitPrice * item.quantity
        const lineTotal = calcLineTotal({
          product_id:      item.product_id,
          product_name:    product?.name ?? '',
          product_sku:     null,
          unit_of_measure: null,
          quantity:        item.quantity,
          unit_price:      unitPrice,
          configuration:   [],
          adjustments:     buildAdjustmentData(item.adjustments),
        })
        const hasAdjs = item.adjustments.some(a => a.label.trim())
        return (
          <div className="text-right text-sm text-muted-foreground space-y-0.5">
            <div>
              {t('Subtotal')}: <span className="font-medium text-foreground">{base.toFixed(2)} {currency}</span>
            </div>
            {hasAdjs && (
              <div>
                {t('Line total')}: <span className="font-semibold text-foreground">{lineTotal.toFixed(2)} {currency}</span>
              </div>
            )}
          </div>
        )
      })()}

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
          formulas={formulas}
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
