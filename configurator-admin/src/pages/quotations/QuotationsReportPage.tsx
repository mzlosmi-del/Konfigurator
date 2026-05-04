import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronsUpDown, ChevronUp, ChevronDown, X } from 'lucide-react'
import { fetchQuotations } from '@/lib/quotations'
import type { Quotation, QuotationStatus } from '@/types/database'
import { STATUS_OPTIONS, STATUS_LABELS, statusVariant } from './quotationStatusConfig'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

type SortKey = 'reference_number' | 'customer_name' | 'valid_until' | 'total_price' | 'created_at'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey | null; sortDir: SortDir }) {
  if (sortBy !== col) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 ml-1 text-foreground" />
    : <ChevronDown className="h-3.5 w-3.5 ml-1 text-foreground" />
}

export function QuotationsReportPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading,    setLoading]    = useState(true)

  const [search,    setSearch]    = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all')
  const [sortBy,    setSortBy]    = useState<SortKey | null>(null)
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  useEffect(() => {
    setLoading(true)
    fetchQuotations()
      .then(setQuotations)
      .catch(() => toast({ title: t('Failed to load quotations'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  function handleSort(col: SortKey) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = quotations.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (q) {
        const match = r.customer_name.toLowerCase().includes(q)
          || r.customer_email.toLowerCase().includes(q)
          || r.reference_number.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })

    if (sortBy) {
      rows = [...rows].sort((a, b) => {
        let av: string | number = a[sortBy] ?? ''
        let bv: string | number = b[sortBy] ?? ''
        if (sortBy === 'total_price') { av = Number(av); bv = Number(bv) }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [quotations, statusFilter, search, sortBy, sortDir])

  // Summary: group totals by currency
  const summary = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of filtered) {
      map[r.currency] = (map[r.currency] ?? 0) + r.total_price
    }
    return Object.entries(map)
  }, [filtered])

  const hasFilters = search || statusFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
  }

  function SortTh({ col, label, align = 'left' }: { col: SortKey; label: string; align?: 'left' | 'right' }) {
    return (
      <th
        className={`px-4 py-3 text-${align} font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors`}
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center gap-0">
          {label}
          <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
        </span>
      </th>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Quotations Report')}
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

      <div className="p-6 space-y-4">

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search by customer or reference…')}
            className="w-72"
          />
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as QuotationStatus | 'all')}
            className="w-52"
          >
            <option value="all">{t('All statuses')}</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>
            ))}
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" />
              {t('Clear')}
            </Button>
          )}
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <SortTh col="reference_number" label={t('Reference')} />
                  <SortTh col="customer_name"    label={t('Customer')} />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Status')}</th>
                  <SortTh col="valid_until"   label={t('Valid until')} />
                  <SortTh col="total_price"   label={t('Total')} align="right" />
                  <SortTh col="created_at"    label={t('Created')} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {t('No quotations match the current filters.')}
                    </td>
                  </tr>
                ) : filtered.map(q => (
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
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[q.status as QuotationStatus] ?? 'secondary'}>
                        {t(STATUS_LABELS[q.status as QuotationStatus] ?? q.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {q.valid_until
                        ? new Date(q.valid_until).toLocaleDateString()
                        : <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {q.total_price.toFixed(2)} {q.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(q.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Summary footer ──────────────────────────────────────────── */}
            <div className="border-t bg-muted/20 px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filtered.length} {filtered.length === 1 ? t('quotation') : t('quotations')}
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {summary.map(([cur, sum]) => `${sum.toFixed(2)} ${cur}`).join(' + ')}
              </span>
            </div>
          </div>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
