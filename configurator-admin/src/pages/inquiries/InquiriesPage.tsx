import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Circle } from 'lucide-react'
import { fetchInquiries } from '@/lib/inquiries'
import type { Inquiry, InquiryStatus } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

type FilterStatus = InquiryStatus | 'all'

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Read', value: 'read' },
  { label: 'Replied', value: 'replied' },
  { label: 'Closed', value: 'closed' },
]

const statusVariant: Record<InquiryStatus, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  new: 'destructive',
  read: 'warning',
  replied: 'success',
  closed: 'secondary',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return `${mins}${t('m ago')}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}${t('h ago')}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}${t('d ago')}`
  return new Date(dateStr).toLocaleDateString()
}

export function InquiriesPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const [inquiries, setInquiries] = useState<(Inquiry & { product: { name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')

  useEffect(() => { load(filter) }, [filter])

  async function load(status: FilterStatus) {
    setLoading(true)
    try {
      setInquiries(await fetchInquiries(status) as any)
    } catch {
      toast({ title: t('Failed to load inquiries'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Inquiries')}
        description={t('Quote requests submitted by your customers.')}
      />

      {/* Filter tabs */}
      <div className="px-4 pt-4 sm:px-6">
        <div className="flex gap-1 border-b">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                filter === f.value
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : inquiries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">{t('No inquiries yet')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === 'all'
                  ? t('When customers submit quote requests, they will appear here.')
                  : t(`No ${filter} inquiries.`)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-6" />
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Customer')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">{t('Product')}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">{t('Total')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Status')}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">{t('Received')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inquiries.map(inq => (
                    <tr
                      key={inq.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/inquiries/${inq.id}`)}
                    >
                      {/* Unread dot */}
                      <td className="px-4 py-3">
                        {inq.status === 'new' && (
                          <Circle className="h-2 w-2 fill-destructive text-destructive" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${inq.status === 'new' ? '' : 'font-normal'}`}>
                          {inq.customer_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{inq.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {inq.product?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                        {inq.total_price != null
                          ? `${inq.total_price.toFixed(2)} ${inq.currency}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[inq.status]} className="capitalize">
                          {t(inq.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden sm:table-cell">
                        {timeAgo(inq.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
