import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, FileText } from 'lucide-react'
import { fetchQuotation, updateQuotation, calcSubtotal, calcTotal } from '@/lib/quotations'
import { buildQuotationPdfBytes, openPdfBlob, type TenantProfile } from '@/lib/quotationPdf'
import { useAuthContext } from '@/components/auth/AuthContext'
import type { Quotation, QuotationStatus, QuotationLineItem, QuotationAdjustment } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

const STATUS_OPTIONS: QuotationStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired']

const statusVariant: Record<QuotationStatus, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  draft:    'secondary',
  sent:     'warning',
  accepted: 'success',
  rejected: 'destructive',
  expired:  'outline',
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const { tenant } = useAuthContext()

  const [quotation,      setQuotation]      = useState<Quotation | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [generatingPdf,  setGeneratingPdf]  = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchQuotation(id)
      .then(setQuotation)
      .catch(() => toast({ title: t('Failed to load quotation'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id])

  async function handleStatusChange(status: QuotationStatus) {
    if (!id || !quotation) return
    setUpdatingStatus(true)
    try {
      const updated = await updateQuotation(id, { status })
      setQuotation(updated)
      toast({ title: t('Status updated') })
    } catch {
      toast({ title: t('Failed to update status'), variant: 'destructive' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleGeneratePdf() {
    if (!quotation) return
    setGeneratingPdf(true)
    try {
      const tenantProfile: TenantProfile = {
        name:            tenant?.name            ?? 'Your store',
        logo_url:        (tenant as any)?.logo_url,
        company_address: (tenant as any)?.company_address,
        company_phone:   (tenant as any)?.company_phone,
        company_email:   (tenant as any)?.company_email,
        company_website: (tenant as any)?.company_website,
        contact_person:  (tenant as any)?.contact_person,
      }
      const bytes = await buildQuotationPdfBytes(tenantProfile, quotation)
      openPdfBlob(bytes)
    } catch (err) {
      toast({ title: t('Failed to generate PDF'), description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
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

      <div className="p-6 space-y-6 max-w-4xl">

        {/* ── Status + meta ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Badge variant={statusVariant[quotation.status]} className="capitalize text-sm px-3 py-1">
            {t(quotation.status)}
          </Badge>
          <Select
            value={quotation.status}
            onChange={e => handleStatusChange(e.target.value as QuotationStatus)}
            disabled={updatingStatus}
            className="w-36"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{t(s.charAt(0).toUpperCase() + s.slice(1))}</option>
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
        </div>

        {/* ── Customer ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('Customer')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Product')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('SKU')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Configuration')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Qty')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Unit Price')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                      {item.product_sku ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3">
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

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
