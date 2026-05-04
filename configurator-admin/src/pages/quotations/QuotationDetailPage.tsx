import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CloudUpload, Download, Pencil, FileText, Trash2 } from 'lucide-react'
import {
  fetchQuotation, updateQuotation, uploadQuotationPdf,
  fetchRejectionReasons, calcSubtotal, calcTotal, deleteQuotation,
} from '@/lib/quotations'
import { fetchProductTexts, fetchGlobalTexts } from '@/lib/products'
import { buildQuotationPdfBytes, openPdfBlob, type TenantProfile } from '@/lib/quotationPdf'
import { useAuthContext } from '@/components/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Quotation, QuotationStatus, QuotationLineItem, QuotationAdjustment, QuotationRejectionReason, ProductText } from '@/types/database'
import { PdfLayoutDialog, type PdfSection, type ProductTextGroup } from './PdfLayoutDialog'
import { STATUS_OPTIONS, STATUS_LABELS, statusVariant } from './quotationStatusConfig'
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

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const { tenant } = useAuthContext()
  const canEdit = useCanEdit('quotations')

  const [quotation,      setQuotation]      = useState<Quotation | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [generatingPdf,    setGeneratingPdf]    = useState(false)
  const [savingPdf,        setSavingPdf]        = useState(false)
  const [pendingBytes,     setPendingBytes]     = useState<Uint8Array | null>(null)
  const [confirmSave,      setConfirmSave]      = useState(false)
  const [layoutOpen,       setLayoutOpen]       = useState(false)
  const [pdfProductTexts,  setPdfProductTexts]  = useState<Record<string, ProductText[]>>({})
  const [pdfGlobalTexts,   setPdfGlobalTexts]   = useState<ProductText[]>([])
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
      await deleteQuotation(id)
      navigate('/quotations')
    } catch {
      toast({ title: t('Failed to delete quotation'), variant: 'destructive' })
      setDeleting(false)
    }
  }

  async function handleGeneratePdf() {
    if (!quotation) return
    setGeneratingPdf(true)
    try {
      const lineItems = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
      const uniqueProductIds = [...new Set(lineItems.map(li => li.product_id).filter(Boolean))]

      const [textsResults, globalTexts] = await Promise.all([
        Promise.all(uniqueProductIds.map(pid => fetchProductTexts(pid).then(texts => ({ pid, texts })))),
        fetchGlobalTexts(),
      ])

      const textsMap: Record<string, ProductText[]> = {}
      const groups: ProductTextGroup[] = []
      for (const { pid, texts } of textsResults) {
        if (texts.length) {
          textsMap[pid] = texts
          const li = lineItems.find(l => l.product_id === pid)
          groups.push({ productId: pid, productName: li?.product_name ?? pid, texts })
        }
      }

      const prof = await buildTenantProfile()
      setPdfProductTexts(textsMap)
      setPdfGlobalTexts(globalTexts)
      setProductTextGroups(groups)
      setTenantProfile(prof)
      setLayoutOpen(true)
    } catch (err) {
      toast({ title: t('Failed to load product data'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleLayoutConfirm(sections: PdfSection[], lang: 'en' | 'sr') {
    if (!quotation) return
    setGeneratingPdf(true)
    try {
      const enabledPtIds = new Set(
        sections.filter(s => s.productTextId && s.visible).map(s => s.productTextId!)
      )
      const hasPtSections = sections.some(s => s.productTextId !== undefined)
      const filtered: Record<string, ProductText[]> = {}
      for (const [pid, texts] of Object.entries(pdfProductTexts)) {
        const kept = hasPtSections ? texts.filter(pt => enabledPtIds.has(pt.id)) : texts
        if (kept.length) filtered[pid] = kept
      }
      const bytes = await buildQuotationPdfBytes(tenantProfile ?? { name: tenant?.name ?? 'Your store' }, quotation, filtered, pdfGlobalTexts, sections, lang)
      setLayoutOpen(false)
      openPdfBlob(bytes)
      setPendingBytes(bytes)
      setConfirmSave(true)
    } catch (err) {
      toast({ title: t('Failed to generate PDF'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleSavePdf() {
    if (!id || !quotation || !pendingBytes) return
    setSavingPdf(true)
    try {
      const url = await uploadQuotationPdf(id, quotation.tenant_id, pendingBytes)
      setQuotation(prev => prev ? { ...prev, pdf_url: url } : prev)
      setPendingBytes(null)
      toast({ title: t('PDF saved to cloud') })
    } catch (err) {
      toast({ title: t('Failed to save PDF'), description: String(err), variant: 'destructive' })
    } finally {
      setSavingPdf(false)
      setConfirmSave(false)
    }
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
            <Button variant="outline" onClick={() => navigate(`/quotations/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              {t('Edit')}
            </Button>
            <Button onClick={handleGeneratePdf} loading={generatingPdf}>
              <FileText className="h-4 w-4 mr-1.5" />
              {t('Generate PDF')}
            </Button>
          </div>
        }
      />

      <div className="p-4 space-y-4 md:p-6 md:space-y-6 max-w-4xl">

        {/* ── Status + meta ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant={statusVariant[quotation.status as QuotationStatus] ?? 'secondary'} className="text-sm px-3 py-1">
            {t(STATUS_LABELS[quotation.status as QuotationStatus] ?? quotation.status)}
          </Badge>
          <Select
            value={quotation.status}
            onChange={e => handleStatusChange(e.target.value as QuotationStatus)}
            disabled={updatingStatus}
            className="w-52"
          >
            {STATUS_OPTIONS.filter(s =>
              s !== 'in_preparation' || quotation.status === 'in_preparation'
            ).map(s => (
              <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>
            ))}
          </Select>
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
                              <span className="font-medium text-foreground">{c.characteristic_name}:</span> {c.value_label}
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

      {/* ── Save PDF confirm ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmSave}
        onOpenChange={open => { if (!open) setConfirmSave(false) }}
        title={t('Save PDF to cloud?')}
        description={t('The PDF will be stored in Supabase storage and a permanent download link will be attached to this quotation.')}
        confirmLabel={t('Save PDF')}
        onConfirm={handleSavePdf}
        loading={savingPdf}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
