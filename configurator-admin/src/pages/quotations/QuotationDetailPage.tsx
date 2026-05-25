import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CloudUpload, Download, Pencil, FileText, Mail, Trash2 } from 'lucide-react'
import {
  fetchQuotation, updateQuotation, uploadQuotationPdf,
  fetchRejectionReasons, calcSubtotal, calcTotal, deleteQuotation,
} from '@/lib/quotations'
import { fetchQuotationTexts, resolveProductTextBlocks, resolveTenantTextBlocks } from '@/lib/texts'
import { buildQuotationPdfBytes, openPdfBlob, type TenantProfile, type PdfTemplate } from '@/lib/quotationPdf'
import { buildQuotationDocxBytes, openDocxBlob } from '@/lib/quotationDocx'
import { buildQuotationXlsxBytes, openXlsxBlob } from '@/lib/quotationXlsx'
import { buildQuotationTechSpecDocxBytes, openTechSpecDocxBlob } from '@/lib/quotationTechSpecDocx'
import { fetchImageAssetsForProducts } from '@/lib/assets'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Quotation, QuotationStatus, QuotationLineItem, QuotationAdjustment, QuotationRejectionReason, TenantText } from '@/types/database'
import { PdfLayoutDialog, type PdfSection, type ProductTextGroup, type PdfTextBlock, type ExportFormat } from './PdfLayoutDialog'
import { SendEmailDialog } from './SendEmailDialog'
import { CustomTemplateMenu } from './CustomTemplateMenu'
import { AttachmentsPanel } from '@/components/quotations/AttachmentsPanel'
import { STATUS_LABELS, statusVariant, STATUS_TRANSITIONS } from './quotationStatusConfig'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useCanEdit } from '@/hooks/usePermission'
import { t } from '@/i18n'
import { logChange } from '@/lib/auditLog'
import { AuditHistory } from '@/components/audit-log/AuditHistory'

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const { tenant, profile } = useAuthContext()
  const userName = profile?.email ?? null
  const canEdit = useCanEdit('quotations')

  const [quotation,      setQuotation]      = useState<Quotation | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [generatingPdf,    setGeneratingPdf]    = useState(false)
  const [generatingTechSpec, setGeneratingTechSpec] = useState(false)
  const [showSendDialog,   setShowSendDialog]   = useState(false)
  const [pdfMode,          setPdfMode]          = useState<'preview' | 'confirm'>('preview')
  const [layoutOpen,       setLayoutOpen]       = useState(false)
  /** All `tenant_texts` rows scoped to this quotation (tenant rows + product
   *  rows for every product referenced by the line items). Pre-fetched in
   *  `handleOpenPdfDialog` so the builder doesn't need to hit Supabase. */
  const [pdfTexts,         setPdfTexts]         = useState<TenantText[]>([])
  /** EN-language tenant text blocks reduced to the dialog's shape, plus the
   *  current dialog language. Captured separately so the toggle list keeps a
   *  consistent set of section ids. */
  const [pdfGlobalTexts,   setPdfGlobalTexts]   = useState<PdfTextBlock[]>([])
  const [productTextGroups, setProductTextGroups] = useState<ProductTextGroup[]>([])
  const [tenantProfile,    setTenantProfile]    = useState<TenantProfile | null>(null)

  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)

  // Rejection dialog state
  const [rejectionReasons,    setRejectionReasons]    = useState<QuotationRejectionReason[]>([])
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [selectedReasonId,    setSelectedReasonId]    = useState('')
  const [rejectionNote,       setRejectionNote]       = useState('')
  const [confirmingRejection, setConfirmingRejection] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([fetchQuotation(id), fetchRejectionReasons()])
      .then(([q, reasons]) => { setQuotation(q); setRejectionReasons(reasons) })
      .catch(() => toast({ title: t('Failed to load quotation'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id])

  async function buildTenantProfile(): Promise<TenantProfile> {
    if (tenant?.id) {
      const { data } = await supabase
        .from('tenants')
        .select('name, logo_url, company_address, company_phone, company_email, company_website, contact_person, vat_number, company_reg_number')
        .eq('id', tenant.id)
        .single()
      if (data) return data as TenantProfile
    }
    return { name: tenant?.name ?? 'Your store' }
  }

  async function handleStatusChange(status: QuotationStatus) {
    if (!id || !quotation) return
    if (status === 'rejected') {
      setSelectedReasonId(quotation.rejection_reason_id ?? '')
      setRejectionNote(quotation.rejection_note ?? '')
      setShowRejectionDialog(true)
      return
    }
    setUpdatingStatus(true)
    try {
      const updated = await updateQuotation(id, { status, rejection_reason_id: null, rejection_note: null })
      logChange({
        entityType: 'quotation',
        entityId:   updated.id,
        entityName: updated.reference_number,
        changeType: 'update',
        diff:       { [t('Status')]: { old: quotation.status, new: status } },
        changedByName: userName,
      })
      setQuotation(updated)
      toast({ title: t('Status updated') })
    } catch {
      toast({ title: t('Failed to update status'), variant: 'destructive' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleConfirmRejection() {
    if (!id || !quotation) return
    setConfirmingRejection(true)
    try {
      const updated = await updateQuotation(id, {
        status: 'rejected',
        rejection_reason_id: selectedReasonId || null,
        rejection_note:      rejectionNote.trim() || null,
      })
      logChange({
        entityType: 'quotation',
        entityId:   updated.id,
        entityName: updated.reference_number,
        changeType: 'update',
        diff: {
          [t('Status')]:           { old: quotation.status,           new: 'rejected' },
          [t('Rejection reason')]: { old: quotation.rejection_reason_id, new: selectedReasonId || null },
          [t('Rejection note')]:   { old: quotation.rejection_note,   new: rejectionNote.trim() || null },
        },
        changedByName: userName,
      })
      setQuotation(updated)
      setShowRejectionDialog(false)
      toast({ title: t('Quotation marked as rejected') })
    } catch {
      toast({ title: t('Failed to update status'), variant: 'destructive' })
    } finally {
      setConfirmingRejection(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    try {
      const ref = quotation?.reference_number ?? null
      await deleteQuotation(id)
      logChange({ entityType: 'quotation', entityId: id, entityName: ref, changeType: 'delete', changedByName: userName })
      navigate('/quotations')
    } catch {
      toast({ title: t('Failed to delete quotation'), variant: 'destructive' })
      setDeleting(false)
    }
  }

  async function handleOpenPdfDialog(mode: 'preview' | 'confirm') {
    if (!quotation) return
    setPdfMode(mode)
    setGeneratingPdf(true)
    try {
      const lineItems = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
      const uniqueProductIds = [...new Set(lineItems.map(li => li.product_id).filter(Boolean))] as string[]

      const [textRows, prof] = await Promise.all([
        fetchQuotationTexts(uniqueProductIds),
        buildTenantProfile(),
      ])

      // Reduce to the dialog's PdfTextBlock shape for the selected language.
      // The dialog uses the row id as section id and the label/content for
      // its preview; the builder will re-resolve from the full rows array.
      const dialogLang: 'en' | 'sr' = (quotation.lang as 'en' | 'sr') ?? 'en'
      const globals = resolveTenantTextBlocks(textRows, dialogLang).map(b => ({
        id:      b.id,
        label:   b.label ?? b.slot,
        content: b.content,
      } satisfies PdfTextBlock))

      const groups: ProductTextGroup[] = []
      for (const pid of uniqueProductIds) {
        const blocks = resolveProductTextBlocks(textRows, pid, dialogLang).map(b => ({
          id:      b.id,
          label:   b.label ?? b.slot,
          content: b.content,
        } satisfies PdfTextBlock))
        if (blocks.length === 0) continue
        const li = lineItems.find(l => l.product_id === pid)
        groups.push({ productId: pid, productName: li?.product_name ?? pid, texts: blocks })
      }

      setPdfTexts(textRows)
      setPdfGlobalTexts(globals)
      setProductTextGroups(groups)
      setTenantProfile(prof)
      setLayoutOpen(true)
    } catch (err) {
      toast({ title: t('Failed to load product data'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleLayoutConfirm(sections: PdfSection[], lang: 'en' | 'sr', template: PdfTemplate, format: ExportFormat) {
    if (!id || !quotation) return
    setGeneratingPdf(true)
    try {
      // The dialog lets the operator toggle individual product-text sections
      // on or off. We honour those toggles by filtering the pre-fetched
      // tenant_texts rows: any row whose id appears in the disabled set is
      // dropped before reaching the builder. Tenant-level rows (terms,
      // footer, global text blocks) are always kept — they are gated by the
      // section visibility flags inside the renderer instead.
      const enabledPtIds = new Set(
        sections.filter(s => s.productTextId && s.visible).map(s => s.productTextId!)
      )
      const hasPtSections = sections.some(s => s.productTextId !== undefined)
      const filteredTexts = hasPtSections
        ? pdfTexts.filter(r => r.level !== 'product' || enabledPtIds.has(r.id))
        : pdfTexts

      const isPreview = pdfMode === 'preview'
      const tp = tenantProfile ?? { name: tenant?.name ?? 'Your store' }

      // Non-PDF formats only download — never upload or change quotation state.
      // The confirm flow is PDF-only because the saved file is the canonical record.
      if (format !== 'pdf') {
        const fileBase = quotation.reference_number ?? 'quotation'
        if (format === 'docx') {
          const bytes = await buildQuotationDocxBytes({
            tenant: tp, quotation, texts: filteredTexts,
            layoutSections: sections, lang,
          })
          openDocxBlob(bytes, `${fileBase}.docx`)
        } else {
          const bytes = await buildQuotationXlsxBytes({
            tenant: tp, quotation, texts: filteredTexts,
            layoutSections: sections, lang,
          })
          openXlsxBlob(bytes, `${fileBase}.xlsx`)
        }
        setLayoutOpen(false)
        return
      }

      const bytes = await buildQuotationPdfBytes(
        tp,
        quotation, filteredTexts, sections, lang,
        isPreview,
        template,
      )
      setLayoutOpen(false)
      openPdfBlob(bytes)

      if (!isPreview) {
        // Confirm path: upload PDF AND flip status atomically. From here the
        // quotation is locked — the saved PDF is the only one that can be reprinted.
        const url     = await uploadQuotationPdf(id, quotation.tenant_id, bytes)
        const updated = await updateQuotation(id, { pdf_url: url, status: 'confirmed', lang })
        logChange({
          entityType: 'quotation',
          entityId:   updated.id,
          entityName: updated.reference_number,
          changeType: 'update',
          diff: { [t('Status')]: { old: quotation.status, new: 'confirmed' } },
          changedByName: userName,
        })
        setQuotation(updated)
        toast({ title: t('Quotation confirmed') })
      }
    } catch (err) {
      toast({ title: t('Failed to generate document'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  /** Build and download the Technical Specification Word document for the
   *  current quotation. This is always a download path — never uploads or
   *  changes quotation state. Pre-fetches the same `tenant_texts` rows the
   *  PDF preview uses plus all `asset_type='image'` rows for the products. */
  async function handleGenerateTechSpec() {
    if (!quotation) return
    setGeneratingTechSpec(true)
    try {
      const lineItems = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
      const productIds = [...new Set(lineItems.map(li => li.product_id).filter(Boolean))] as string[]
      // The Tech Spec reads characteristic + characteristic_value spec text
      // off `tenant_texts` directly (unlike the quotation PDF, which uses the
      // snapshot on each line item). Walk the configuration to collect both
      // sets of IDs so `fetchQuotationTexts` brings the relevant rows along.
      const characteristicIds: string[] = []
      const valueIds:          string[] = []
      for (const li of lineItems) {
        const cfg = Array.isArray(li.configuration) ? li.configuration : []
        for (const entry of cfg) {
          if (entry.characteristic_id) characteristicIds.push(entry.characteristic_id)
          if (entry.value_id)          valueIds.push(entry.value_id)
        }
      }

      const [textRows, assets, prof] = await Promise.all([
        fetchQuotationTexts(productIds, characteristicIds, valueIds),
        fetchImageAssetsForProducts(productIds),
        buildTenantProfile(),
      ])

      const lang: 'en' | 'sr' = (quotation.lang as 'en' | 'sr') ?? 'en'
      const bytes = await buildQuotationTechSpecDocxBytes({
        tenant:    prof,
        quotation,
        texts:     textRows,
        assets,
        lang,
      })
      const filename = `tech-spec-${quotation.reference_number ?? quotation.id.slice(0, 8)}.docx`
      openTechSpecDocxBlob(bytes, filename)
    } catch (err) {
      toast({ title: t('Failed to generate technical specification'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingTechSpec(false)
    }
  }

  function handleSendToCustomer() {
    if (!id || !quotation) return
    if (!quotation.customer_email) {
      toast({ title: t('No customer email on this quotation'), variant: 'destructive' })
      return
    }
    if (quotation.status !== 'confirmed' && quotation.status !== 'sent') {
      toast({ title: t('Confirm the quotation first'), variant: 'destructive' })
      return
    }
    setShowSendDialog(true)
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={t('Quotation')} />
        <div className="flex justify-center py-16"><Spinner /></div>
      </div>
    )
  }

  if (!quotation) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={t('Quotation not found')} />
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate('/quotations')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t('Back to Quotations')}
          </Button>
        </div>
      </div>
    )
  }

  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const subtotal = calcSubtotal(items)
  const total    = calcTotal(subtotal, adjs)

  const rejectionReason = rejectionReasons.find(r => r.id === quotation.rejection_reason_id)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={quotation.reference_number}
        description={
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate('/quotations')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Back to Quotations')}
          </button>
        }
        action={
          <div className="flex items-center gap-2">
            {canEdit && quotation.status === 'in_preparation' && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title={t('Delete quotation')}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {quotation.pdf_url && (
              <Button variant="outline" asChild>
                <a href={quotation.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1.5" />
                  {t('Download PDF')}
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleGenerateTechSpec}
              loading={generatingTechSpec}
              title={t('Generate a Word document with the technical specification of the products on this quotation.')}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              {t('Technical spec')}
            </Button>
            {/* Custom document templates — additive export option. Existing
                exports above are unchanged and remain the default. */}
            <CustomTemplateMenu
              quotation={quotation}
              buildTenantProfile={buildTenantProfile}
              lang={(quotation.lang as 'en' | 'sr') ?? 'en'}
              onError={msg => toast({ title: t('Failed to generate document'), description: msg, variant: 'destructive' })}
            />
            {canEdit && (quotation.status === 'confirmed' || quotation.status === 'sent') && quotation.pdf_url && (
              <Button
                variant="outline"
                onClick={handleSendToCustomer}
                disabled={!quotation.customer_email}
                title={!quotation.customer_email ? t('No customer email on this quotation') : undefined}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                {quotation.status === 'sent' ? t('Resend to customer') : t('Send to customer')}
              </Button>
            )}
            {canEdit && quotation.status === 'in_preparation' && (
              <>
                <Button variant="outline" onClick={() => navigate(`/quotations/${id}/edit`)}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  {t('Edit')}
                </Button>
                <Button variant="outline" onClick={() => handleOpenPdfDialog('preview')} loading={generatingPdf && pdfMode === 'preview'}>
                  <FileText className="h-4 w-4 mr-1.5" />
                  {t('Preview PDF')}
                </Button>
                <Button onClick={() => handleOpenPdfDialog('confirm')} loading={generatingPdf && pdfMode === 'confirm'}>
                  <FileText className="h-4 w-4 mr-1.5" />
                  {t('Confirm & Generate PDF')}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="p-4 space-y-4 md:p-6 md:space-y-6 max-w-4xl">

        {/* ── Status + meta ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant={statusVariant[quotation.status as QuotationStatus] ?? 'secondary'} className="text-sm px-3 py-1">
            {t(STATUS_LABELS[quotation.status as QuotationStatus] ?? quotation.status)}
          </Badge>
          {STATUS_TRANSITIONS[quotation.status as QuotationStatus]?.length > 0 && (
            <Select
              value={quotation.status}
              onChange={e => handleStatusChange(e.target.value as QuotationStatus)}
              disabled={updatingStatus}
              className="w-52"
            >
              <option value={quotation.status}>{t(STATUS_LABELS[quotation.status as QuotationStatus])}</option>
              {STATUS_TRANSITIONS[quotation.status as QuotationStatus].map(s => (
                <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>
              ))}
            </Select>
          )}
          <span className="text-sm text-muted-foreground">
            {t('Created')}: {new Date(quotation.created_at).toLocaleDateString()}
          </span>
          {quotation.valid_until && (
            <span className="text-sm text-muted-foreground">
              {t('Valid until')}: {new Date(quotation.valid_until).toLocaleDateString()}
            </span>
          )}
          {quotation.pdf_url && (
            <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
              <CloudUpload className="h-3 w-3" />
              {t('PDF saved')}
            </Badge>
          )}
        </div>

        {/* ── Source inquiry link ────────────────────────────────────────── */}
        {quotation.source_inquiry_id && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            {t('Created from inquiry')}{' '}
            <Link
              to={`/inquiries/${quotation.source_inquiry_id}`}
              className="font-mono text-xs text-primary hover:underline"
            >
              #{quotation.source_inquiry_id.slice(0, 8)}
            </Link>
          </div>
        )}

        {/* ── Rejection info ─────────────────────────────────────────────── */}
        {quotation.status === 'rejected' && (rejectionReason || quotation.rejection_note) && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {rejectionReason && (
                <p className="font-medium text-destructive">{rejectionReason.label}</p>
              )}
              {quotation.rejection_note && (
                <p className="text-muted-foreground">{quotation.rejection_note}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Customer ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Customer')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('Name')}: </span>
              <span className="font-medium">{quotation.customer_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('Email')}: </span>
              <span className="font-medium">{quotation.customer_email}</span>
            </div>
            {quotation.customer_company && (
              <div>
                <span className="text-muted-foreground">{t('Company')}: </span>
                <span>{quotation.customer_company}</span>
              </div>
            )}
            {quotation.customer_phone && (
              <div>
                <span className="text-muted-foreground">{t('Phone')}: </span>
                <span>{quotation.customer_phone}</span>
              </div>
            )}
            {quotation.customer_address && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('Address')}: </span>
                <span>{quotation.customer_address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Attachments (extra files bundled into the customer email) ─── */}
        <AttachmentsPanel
          quotationId={quotation.id}
          tenantId={quotation.tenant_id}
          referenceNumber={quotation.reference_number}
          canEdit={canEdit && quotation.status !== 'accepted_no_changes'
            && quotation.status !== 'accepted_with_changes'
            && quotation.status !== 'rejected'
            && quotation.status !== 'expired'}
        />

        {/* ── Line items ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Line Items')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Product')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">{t('SKU')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">{t('Configuration')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Qty')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Unit Price')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.product_name}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground hidden sm:table-cell">
                      {item.product_sku ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {item.configuration.length > 0 ? (
                        <div className="space-y-0.5">
                          {item.configuration.map((c, ci) => (
                            <div key={ci} className="text-xs text-muted-foreground">
                              {c.value_label
                                ? <><span className="font-medium text-foreground">{c.characteristic_name}:</span> {c.value_label}</>
                                : <span className="font-medium text-foreground">{c.characteristic_name}</span>}
                              {c.price_modifier !== 0 && (
                                <span className={c.price_modifier > 0 ? 'text-emerald-600 ml-1' : 'text-red-600 ml-1'}>
                                  ({c.price_modifier > 0 ? '+' : ''}{c.price_modifier.toFixed(2)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.unit_price.toFixed(2)} {quotation.currency}
                      {item.unit_of_measure && (
                        <span className="text-xs text-muted-foreground ml-1">/ {item.unit_of_measure}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {(item.unit_price * item.quantity).toFixed(2)} {quotation.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Price summary ──────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 border rounded-lg p-4 bg-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Subtotal')}</span>
              <span>{subtotal.toFixed(2)} {quotation.currency}</span>
            </div>
            {(() => {
              let running = subtotal
              return adjs.map((adj, i) => {
                const amount = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
                const applied = adj.type === 'discount' ? -amount : amount
                if (adj.type !== 'discount') running += amount
                else running -= amount
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{adj.label} <span className="text-xs">({t(adj.type)})</span></span>
                    <span className={applied >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {applied >= 0 ? '+' : ''}{applied.toFixed(2)} {quotation.currency}
                    </span>
                  </div>
                )
              })
            })()}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{t('Total')}</span>
              <span className="text-lg">{total.toFixed(2)} {quotation.currency}</span>
            </div>
          </div>
        </div>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        {quotation.notes && (
          <Card>
            <CardHeader><CardTitle>{t('Notes')}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{quotation.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* ── Change history (admin only) ───────────────────────────────── */}
        {profile?.role === 'admin' && (
          <Card>
            <CardHeader><CardTitle>{t('Change history')}</CardTitle></CardHeader>
            <CardContent>
              <AuditHistory entityType="quotation" entityId={quotation.id} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Rejection dialog ───────────────────────────────────────────────── */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Mark as Rejected')}</DialogTitle>
            <DialogDescription>
              {t('Select a reason and optionally add a note.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('Reason')}</label>
              <Select
                value={selectedReasonId}
                onChange={e => setSelectedReasonId(e.target.value)}
                className="w-full"
              >
                <option value="">{t('— select a reason —')}</option>
                {rejectionReasons.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Select>
              {rejectionReasons.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('No predefined reasons yet. Add some in Settings.')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('Additional note')} <span className="text-muted-foreground font-normal">({t('optional')})</span>
              </label>
              <Textarea
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                rows={3}
                placeholder={t('e.g. Customer requested a revised offer instead.')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowRejectionDialog(false)} disabled={confirmingRejection}>
              {t('Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmRejection} loading={confirmingRejection}>
              {t('Confirm rejection')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PDF layout / text selection ───────────────────────────────────── */}
      <PdfLayoutDialog
        open={layoutOpen}
        onOpenChange={setLayoutOpen}
        globalTexts={pdfGlobalTexts}
        productTexts={productTextGroups}
        quotationHasNotes={!!quotation?.notes?.trim()}
        onConfirm={handleLayoutConfirm}
        loading={generatingPdf}
        quotation={quotation}
        tenant={tenantProfile ?? { name: tenant?.name ?? 'Your store' }}
        pdfOnly={pdfMode === 'confirm'}
      />

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={open => { if (!open) setConfirmDelete(false) }}
        title={t('Delete quotation?')}
        description={t('This quotation will be permanently deleted. This cannot be undone.')}
        confirmLabel={t('Delete')}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {showSendDialog && quotation && quotation.customer_email && quotation.public_token && (
        <SendEmailDialog
          open
          onClose={() => setShowSendDialog(false)}
          onSent={sentTo => {
            setShowSendDialog(false)
            toast({ title: t('Quotation sent'), description: sentTo ? `${t('To')}: ${sentTo}` : undefined })
            // Edge function flips status to 'sent' after a successful Resend
            // call; refresh so the badge and button label update immediately.
            if (id) fetchQuotation(id).then(setQuotation).catch(() => {})
          }}
          onError={msg => toast({ title: t('Failed to send'), description: msg, variant: 'destructive' })}
          quotationId={quotation.id}
          referenceNumber={quotation.reference_number}
          customerName={quotation.customer_name}
          customerEmail={quotation.customer_email}
          totalPrice={total}
          currency={quotation.currency}
          validUntil={quotation.valid_until}
          publicUrl={`${window.location.origin}/q/${quotation.public_token}`}
          tenantName={tenant?.name ?? 'Your store'}
          lang={quotation.lang === 'sr' ? 'sr' : 'en'}
          defaultIntro={(() => {
            // Fetched once in `handleOpenPdfDialog`; falls back to '' when
            // the user hasn't opened the PDF preview yet.
            const lang = quotation.lang === 'sr' ? 'sr' : 'en'
            const exact = pdfTexts.find(r =>
              r.level === 'tenant' && r.reference_id === null
              && r.slot === 'quotation_email_intro' && r.language === lang
            )
            const fallback = pdfTexts.find(r =>
              r.level === 'tenant' && r.reference_id === null
              && r.slot === 'quotation_email_intro'
            )
            return (exact ?? fallback)?.content ?? ''
          })()}
          alreadyResent={!!quotation.responded_at}
        />
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
