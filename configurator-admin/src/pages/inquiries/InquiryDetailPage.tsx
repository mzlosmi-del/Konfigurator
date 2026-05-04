import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, ExternalLink, FileText, ArrowRight } from 'lucide-react'
import { fetchInquiry, updateInquiryStatus } from '@/lib/inquiries'
import { supabase } from '@/lib/supabase'
import type { Inquiry, InquiryStatus } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useCanEdit } from '@/hooks/usePermission'
import { t } from '@/i18n'

type InquiryWithProduct = Inquiry & { product: { name: string } | null }

const statusVariant: Record<InquiryStatus, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  new: 'destructive',
  read: 'warning',
  replied: 'success',
  closed: 'secondary',
}

const STATUS_OPTIONS: InquiryStatus[] = ['new', 'read', 'replied', 'closed']

interface ConfigLineItem {
  characteristic_name: string
  value_label: string
  price_modifier: number
}

function parseConfig(raw: unknown): ConfigLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is ConfigLineItem =>
      typeof item === 'object' &&
      item !== null &&
      'characteristic_name' in item &&
      'value_label' in item
  )
}

export function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const canEdit = useCanEdit('inquiries')

  const [inquiry, setInquiry] = useState<InquiryWithProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [linkedQuotationId, setLinkedQuotationId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    load(id)
  }, [id])

  async function load(inquiryId: string) {
    setLoading(true)
    try {
      const [data, linkedQ] = await Promise.all([
        fetchInquiry(inquiryId),
        supabase
          .from('quotations')
          .select('id')
          .eq('source_inquiry_id', inquiryId)
          .maybeSingle(),
      ])
      setInquiry(data as InquiryWithProduct)
      setLinkedQuotationId((linkedQ.data as { id: string } | null)?.id ?? null)

      // Auto-mark as read when opened
      if (data.status === 'new') {
        const updated = await updateInquiryStatus(inquiryId, 'read')
        setInquiry(prev => prev ? { ...prev, status: updated.status } : prev)
      }
    } catch {
      toast({ title: t('Inquiry not found'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(next: InquiryStatus) {
    if (!inquiry) return
    setUpdatingStatus(true)
    try {
      const updated = await updateInquiryStatus(inquiry.id, next)
      setInquiry(prev => prev ? { ...prev, status: updated.status } : prev)
      toast({ title: t('Status updated') })
    } catch {
      toast({ title: t('Failed to update status'), variant: 'destructive' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  function handleEmailReply() {
    if (!inquiry) return
    const subject = encodeURIComponent(`Re: Your configuration inquiry`)
    const body = encodeURIComponent(
      `Hi ${inquiry.customer_name},\n\nThank you for your inquiry.\n\n`
    )
    window.open(`mailto:${inquiry.customer_email}?subject=${subject}&body=${body}`)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  if (!inquiry) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{t('Inquiry not found.')}</p>
        <Button variant="link" className="mt-2 p-0" onClick={() => navigate('/inquiries')}>
          {t('Back to inquiries')}
        </Button>
      </div>
    )
  }

  const configItems = parseConfig(inquiry.configuration)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Inquiry from ${inquiry.customer_name}`}
        description={
          <span className="flex items-center gap-2">
            <Badge variant={statusVariant[inquiry.status]} className="capitalize">
              {t(inquiry.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(inquiry.created_at).toLocaleString()}
            </span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleEmailReply}>
              <Mail className="h-4 w-4" />
              {t('Reply by email')}
            </Button>
          </div>
        }
      />

      {/* Back link */}
      <div className="px-6 pt-4">
        <button
          onClick={() => navigate('/inquiries')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('All inquiries')}
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 gap-5 max-w-3xl lg:grid-cols-3">

        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Configuration snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Configuration')}</CardTitle>
            </CardHeader>
            <CardContent>
              {configItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('No configuration data recorded.')}</p>
              ) : (
                <div className="space-y-0">
                  {configItems.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between py-2.5 text-sm">
                        <span className="text-muted-foreground">{item.characteristic_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{item.value_label}</span>
                          {item.price_modifier !== 0 && (
                            <span className={`text-xs tabular-nums ${item.price_modifier > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {item.price_modifier > 0 ? '+' : ''}
                              {item.price_modifier.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {i < configItems.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}

              {/* Total price */}
              {inquiry.total_price != null && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between py-2 text-sm">
                    <span className="font-semibold">{t('Total')}</span>
                    <span className="font-semibold tabular-nums text-base">
                      {inquiry.total_price.toFixed(2)} {inquiry.currency}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Customer message */}
          {inquiry.message && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('Message')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — sidebar details */}
        <div className="space-y-5">

          {/* Convert / linked quotation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Quotation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {linkedQuotationId ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('A quotation has already been created from this inquiry.')}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/quotations/${linkedQuotationId}/edit`)}
                  >
                    <FileText className="h-4 w-4" />
                    {t('View linked quotation')}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('Pre-fill a new quotation with the customer info, product, and selected options from this inquiry.')}
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/quotations/new?inquiry_id=${inquiry.id}`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                    {t('Convert to quotation')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status control */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('Status')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={inquiry.status}
                  onChange={e => handleStatusChange(e.target.value as InquiryStatus)}
                  disabled={updatingStatus}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s} className="capitalize">{t(s)}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('Changing status here does not send any email. Use "Reply by email" to contact the customer.')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Customer details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Customer')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t('Name')}</p>
                <p className="font-medium">{inquiry.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t('Email')}</p>
                <a
                  href={`mailto:${inquiry.customer_email}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {inquiry.customer_email}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Product */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Product')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{inquiry.product?.name ?? '—'}</p>
              <button
                onClick={() => navigate(`/products/${inquiry.product_id}/edit`)}
                className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
              >
                {t('View product')} <ExternalLink className="h-3 w-3" />
              </button>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Timeline')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('Received')}</span>
                <span className="text-xs">{new Date(inquiry.created_at).toLocaleString()}</span>
              </div>
              {inquiry.updated_at !== inquiry.created_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Updated')}</span>
                  <span className="text-xs">{new Date(inquiry.updated_at).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
