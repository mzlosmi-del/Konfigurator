import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, FileText, Plus } from 'lucide-react'
import { fetchQuotations } from '@/lib/quotations'
import type { Quotation, QuotationStatus } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'
import { STATUS_LABELS, statusVariant } from './quotationStatusConfig'

export function QuotationsPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      setQuotations(await fetchQuotations())
    } catch {
      toast({ title: t('Failed to load quotations'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Quotations')}
        description={t('Create and manage quotations for your customers.')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/quotations/report')}>
              <BarChart2 className="h-4 w-4 mr-1.5" />
              {t('Report')}
            </Button>
            <Button onClick={() => navigate('/quotations/new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t('New Quotation')}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : quotations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">{t('No quotations yet')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Create your first quotation to get started.')}
              </p>
              <Button className="mt-4" onClick={() => navigate('/quotations/new')}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t('New Quotation')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Reference')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Customer')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Products')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Total')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Status')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotations.map(q => {
                  const items = Array.isArray(q.line_items) ? q.line_items : []
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/quotations/${q.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {q.reference_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{q.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{q.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {items.length}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {q.total_price.toFixed(2)} {q.currency}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[q.status as QuotationStatus] ?? 'secondary'}>
                          {STATUS_LABELS[q.status as QuotationStatus] ?? q.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
