import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, FileText, Plus, Copy, ExternalLink } from 'lucide-react'
import { fetchQuotations, duplicateQuotation } from '@/lib/quotations'
import type { Quotation, QuotationStatus } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useCanEdit } from '@/hooks/usePermission'
import { useAuthContext } from '@/components/auth/AuthContext'
import { t } from '@/i18n'
import { STATUS_OPTIONS, STATUS_LABELS, statusVariant } from './quotationStatusConfig'
import { logChange } from '@/lib/auditLog'
import { DataTable, type DataTableColumn } from '@/components/data-table/DataTable'
import { QuickFilterChips, type QuickFilter } from '@/components/data-table/QuickFilterChips'
import type { TableLayout } from '@/lib/uiPreferences'

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'draft',     label: 'Draft' },
  { id: 'awaiting',  label: 'Awaiting customer' },
  { id: 'won',       label: 'Won' },
  { id: 'expiring',  label: 'Expiring in 7 days' },
  { id: 'this_mo',   label: 'This month' },
]

const DEFAULT_LAYOUT: TableLayout = {
  columns: [
    { id: 'reference_number', visible: true  },
    { id: 'customer_name',    visible: true  },
    { id: 'customer_email',   visible: false },
    { id: 'customer_company', visible: false },
    { id: 'customer_phone',   visible: false },
    { id: 'items_count',      visible: true  },
    { id: 'subtotal',         visible: false },
    { id: 'total_price',      visible: true  },
    { id: 'status',           visible: true  },
    { id: 'valid_until',      visible: true  },
    { id: 'lang',             visible: false },
    { id: 'source_inquiry_id',visible: false },
    { id: 'responded_at',     visible: false },
    { id: 'created_at',       visible: true  },
    { id: 'updated_at',       visible: false },
  ],
  sortBy:  'created_at',
  sortDir: 'desc',
}

export function QuotationsPage() {
  const navigate = useNavigate()
  const canEdit = useCanEdit('quotations')
  const { toasts, toast, dismiss } = useToast()
  const { profile } = useAuthContext()
  const userName = profile?.email ?? null

  const [quotations, setQuotations]   = useState<Quotation[]>([])
  const [loading, setLoading]         = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all')
  const [quick, setQuick]             = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setQuotations(await fetchQuotations())
    } catch {
      toast({ title: t('Failed to load quotations'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleDuplicate(e: React.MouseEvent, sourceId: string) {
    e.stopPropagation()
    if (duplicatingId) return
    setDuplicatingId(sourceId)
    try {
      const copy = await duplicateQuotation(sourceId)
      logChange({ entityType: 'quotation', entityId: copy.id, entityName: copy.reference_number, changeType: 'create', changedByName: userName })
      navigate(`/quotations/${copy.id}/edit`)
    } catch (err) {
      toast({ title: t('Failed to copy quotation'), description: String(err), variant: 'destructive' })
    } finally {
      setDuplicatingId(null)
    }
  }

  function toggleQuick(id: string) {
    setQuick(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const in7d = Date.now() + 7 * 24 * 60 * 60 * 1000
    return quotations.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (q) {
        const hay = `${r.customer_name} ${r.customer_email} ${r.customer_company ?? ''} ${r.reference_number}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (quick.includes('draft')    && r.status !== 'in_preparation') return false
      if (quick.includes('awaiting') && !(r.status === 'sent' && !r.responded_at)) return false
      if (quick.includes('won')      && !(r.status === 'accepted_no_changes' || r.status === 'accepted_with_changes')) return false
      if (quick.includes('expiring')) {
        if (!r.valid_until) return false
        const vu = new Date(r.valid_until).getTime()
        if (vu < Date.now() || vu > in7d || (r.status !== 'confirmed' && r.status !== 'sent')) return false
      }
      if (quick.includes('this_mo')  && new Date(r.created_at).getTime() < startOfMonth.getTime()) return false
      return true
    })
  }, [quotations, statusFilter, search, quick])

  const columns: DataTableColumn<Quotation>[] = [
    {
      id: 'reference_number', label: t('Reference'), sortable: true, fixed: true,
      sortValue: r => r.reference_number,
      render: row => <span className="font-mono text-xs text-muted-foreground">{row.reference_number}</span>,
    },
    {
      id: 'customer_name', label: t('Customer'), sortable: true,
      sortValue: r => r.customer_name,
      render: row => (
        <div>
          <p className="font-medium">{row.customer_name}</p>
          <p className="text-xs text-muted-foreground">{row.customer_email}</p>
        </div>
      ),
    },
    {
      id: 'customer_email', label: t('Email'), sortable: true,
      sortValue: r => r.customer_email,
      render: row => <span className="text-muted-foreground">{row.customer_email}</span>,
    },
    {
      id: 'customer_company', label: t('Company'), sortable: true,
      sortValue: r => r.customer_company ?? '',
      render: row => <span className="text-muted-foreground">{row.customer_company ?? '—'}</span>,
    },
    {
      id: 'customer_phone', label: t('Phone'), sortable: true,
      sortValue: r => r.customer_phone ?? '',
      render: row => <span className="text-muted-foreground">{row.customer_phone ?? '—'}</span>,
    },
    {
      id: 'items_count', label: t('Items'), align: 'right', sortable: true,
      sortValue: r => Array.isArray(r.line_items) ? (r.line_items as unknown[]).length : 0,
      render: row => (
        <span className="text-muted-foreground tabular-nums">
          {Array.isArray(row.line_items) ? (row.line_items as unknown[]).length : 0}
        </span>
      ),
    },
    {
      id: 'subtotal', label: t('Subtotal'), align: 'right', sortable: true,
      sortValue: r => r.subtotal ?? 0,
      render: row => (
        <span className="tabular-nums text-muted-foreground">
          {(row.subtotal ?? row.total_price).toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      id: 'total_price', label: t('Total'), align: 'right', sortable: true,
      sortValue: r => Number(r.total_price),
      render: row => (
        <span className="tabular-nums font-medium">
          {row.total_price.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      id: 'status', label: t('Status'), sortable: true,
      sortValue: r => STATUS_LABELS[r.status as QuotationStatus] ?? r.status,
      render: row => (
        <Badge variant={statusVariant[row.status as QuotationStatus] ?? 'secondary'}>
          {t(STATUS_LABELS[row.status as QuotationStatus] ?? row.status)}
        </Badge>
      ),
    },
    {
      id: 'valid_until', label: t('Valid until'), sortable: true,
      sortValue: r => r.valid_until ?? null,
      render: row => {
        if (!row.valid_until) return <span className="text-muted-foreground opacity-40">—</span>
        const days = Math.round((new Date(row.valid_until).getTime() - Date.now()) / 86_400_000)
        const cls = days < 0 ? 'text-destructive' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground'
        return (
          <span className="text-xs">
            <span className="text-muted-foreground">{new Date(row.valid_until).toLocaleDateString()}</span>
            <span className={`ml-1.5 ${cls}`}>
              {days < 0 ? `(${-days}d overdue)` : `(${days}d)`}
            </span>
          </span>
        )
      },
    },
    {
      id: 'lang', label: t('Lang'), sortable: true,
      sortValue: r => r.lang ?? '',
      render: row => <span className="text-xs uppercase text-muted-foreground">{row.lang ?? '—'}</span>,
    },
    {
      id: 'source_inquiry_id', label: t('From inquiry'),
      render: row => row.source_inquiry_id
        ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            title={t('Open source inquiry')}
            onClick={e => { e.stopPropagation(); navigate(`/inquiries/${row.source_inquiry_id}`) }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )
        : <span className="text-muted-foreground opacity-40">—</span>,
    },
    {
      id: 'responded_at', label: t('Responded'), sortable: true,
      sortValue: r => r.responded_at ?? null,
      render: row => row.responded_at
        ? <span className="text-xs text-muted-foreground">{new Date(row.responded_at).toLocaleDateString()}</span>
        : <span className="text-muted-foreground opacity-40">—</span>,
    },
    {
      id: 'created_at', label: t('Created'), align: 'right', sortable: true,
      sortValue: r => r.created_at,
      render: row => (
        <span className="text-right text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'updated_at', label: t('Updated'), align: 'right', sortable: true,
      sortValue: r => r.updated_at,
      render: row => (
        <span className="text-right text-xs text-muted-foreground">
          {new Date(row.updated_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

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
            {canEdit && (
              <Button onClick={() => navigate('/quotations/new')}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t('New Quotation')}
              </Button>
            )}
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <DataTable<Quotation>
          tableKey="quotations"
          rows={filtered}
          columns={columns}
          defaultLayout={DEFAULT_LAYOUT}
          loading={loading}
          emptyIcon={FileText}
          emptyTitle={t('No quotations match the current filters.')}
          emptyHint={t('Create your first quotation to get started.')}
          rowKey={row => row.id}
          onRowOpen={row => navigate(`/quotations/${row.id}`)}
          toolbarStart={
            <>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Search customer, company or reference…')}
                className="w-64"
              />
              <Select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as QuotationStatus | 'all')}
                className="w-44"
              >
                <option value="all">{t('All statuses')}</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>
                ))}
              </Select>
              <QuickFilterChips filters={QUICK_FILTERS} active={quick} onToggle={toggleQuick} />
            </>
          }
          rowActions={canEdit ? row => (
            <Button
              variant="ghost"
              size="icon"
              title={t('Copy quotation')}
              loading={duplicatingId === row.id}
              onClick={e => handleDuplicate(e, row.id)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : undefined}
        />
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
