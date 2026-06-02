import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Circle } from 'lucide-react'
import { fetchInquiries, timeAgo } from '@/lib/inquiries'
import type { Inquiry, InquiryStatus } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { DataTable, type DataTableColumn } from '@/components/data-table/DataTable'
import { QuickFilterChips, type QuickFilter } from '@/components/data-table/QuickFilterChips'
import type { TableLayout } from '@/lib/uiPreferences'
import { t } from '@/i18n'

type InquiryRow = Inquiry & { product: { name: string } | null }
type StatusFilter = InquiryStatus | 'all'

const statusVariant: Record<InquiryStatus, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  new:     'destructive',
  read:    'warning',
  replied: 'success',
  closed:  'secondary',
}

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'unread',  label: 'Unread' },
  { id: 'today',   label: 'Today' },
  { id: 'last7',   label: 'Last 7 days' },
  { id: 'priced',  label: 'Has price' },
]

const DEFAULT_LAYOUT: TableLayout = {
  columns: [
    { id: 'dot',             visible: true  },
    { id: 'customer_name',   visible: true  },
    { id: 'customer_email',  visible: false },
    { id: 'product',         visible: true  },
    { id: 'total_price',     visible: true  },
    { id: 'currency',        visible: false },
    { id: 'config_count',    visible: false },
    { id: 'message_preview', visible: false },
    { id: 'status',          visible: true  },
    { id: 'created_at',      visible: true  },
    { id: 'created_at_abs',  visible: false },
  ],
  sortBy:  'created_at',
  sortDir: 'desc',
}

export function InquiriesPage() {
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()

  const [inquiries, setInquiries]     = useState<InquiryRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [status, setStatus]           = useState<StatusFilter>('all')
  const [search, setSearch]           = useState('')
  const [quick, setQuick]             = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInquiries(await fetchInquiries() as unknown as InquiryRow[])
    } catch {
      toast({ title: t('Failed to load inquiries'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function toggleQuick(id: string) {
    setQuick(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return inquiries.filter(row => {
      if (status !== 'all' && row.status !== status) return false
      if (q) {
        const hay = `${row.customer_name} ${row.customer_email} ${row.product?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (quick.includes('unread') && row.status !== 'new') return false
      if (quick.includes('today')  && new Date(row.created_at).getTime() < startOfDay.getTime()) return false
      if (quick.includes('last7')  && new Date(row.created_at).getTime() < sevenDaysAgo) return false
      if (quick.includes('priced') && row.total_price == null) return false
      return true
    })
  }, [inquiries, status, search, quick])

  const columns: DataTableColumn<InquiryRow>[] = [
    {
      id: 'dot', label: '', width: '32px',
      render: row => row.status === 'new'
        ? <Circle className="h-2 w-2 fill-destructive text-destructive" />
        : null,
    },
    {
      id: 'customer_name', label: t('Customer'), sortable: true,
      sortValue: r => r.customer_name,
      render: row => (
        <div>
          <p className={`font-medium ${row.status === 'new' ? '' : 'font-normal'}`}>{row.customer_name}</p>
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
      id: 'product', label: t('Product'), sortable: true,
      sortValue: r => r.product?.name ?? '',
      render: row => <span className="text-muted-foreground">{row.product?.name ?? '—'}</span>,
    },
    {
      id: 'total_price', label: t('Total'), align: 'right', sortable: true,
      sortValue: r => r.total_price ?? null,
      render: row => row.total_price != null
        ? <span className="tabular-nums">{row.total_price.toFixed(2)} {row.currency}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'currency', label: t('Currency'), sortable: true,
      sortValue: r => r.currency,
      render: row => <span className="text-xs text-muted-foreground">{row.currency}</span>,
    },
    {
      id: 'config_count', label: t('Options'), align: 'right', sortable: true,
      sortValue: r => Array.isArray(r.configuration) ? (r.configuration as unknown[]).length : 0,
      render: row => (
        <span className="text-muted-foreground tabular-nums">
          {Array.isArray(row.configuration) ? (row.configuration as unknown[]).length : 0}
        </span>
      ),
    },
    {
      id: 'message_preview', label: t('Message'),
      render: row => (
        <span className="text-muted-foreground text-xs truncate inline-block max-w-[16rem]">
          {row.message?.slice(0, 80) ?? '—'}
        </span>
      ),
    },
    {
      id: 'status', label: t('Status'), sortable: true,
      sortValue: r => r.status,
      render: row => (
        <Badge variant={statusVariant[row.status]} className="capitalize">
          {t(row.status)}
        </Badge>
      ),
    },
    {
      id: 'created_at', label: t('Received'), align: 'right', sortable: true,
      sortValue: r => r.created_at,
      render: row => (
        <span className="text-right text-muted-foreground text-xs">{timeAgo(row.created_at)}</span>
      ),
    },
    {
      id: 'created_at_abs', label: t('Date'), align: 'right', sortable: true,
      sortValue: r => r.created_at,
      render: row => (
        <span className="text-right text-muted-foreground text-xs">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Inquiries')}
        description={t('Quote requests submitted by your customers.')}
      />

      <div className="p-4 md:p-6">
        <DataTable<InquiryRow>
          tableKey="inquiries"
          rows={filtered}
          columns={columns}
          defaultLayout={DEFAULT_LAYOUT}
          loading={loading}
          emptyIcon={Inbox}
          emptyTitle={t('No inquiries match the current filters.')}
          emptyHint={t('When customers submit quote requests, they will appear here.')}
          rowKey={row => row.id}
          onRowOpen={row => navigate(`/inquiries/${row.id}`)}
          toolbarStart={
            <>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Search customer, email or product…')}
                className="w-64"
              />
              <Select
                value={status}
                onChange={e => setStatus(e.target.value as StatusFilter)}
                className="w-36"
              >
                <option value="all">{t('All statuses')}</option>
                <option value="new">{t('New')}</option>
                <option value="read">{t('Read')}</option>
                <option value="replied">{t('Replied')}</option>
                <option value="closed">{t('Closed')}</option>
              </Select>
              <QuickFilterChips filters={QUICK_FILTERS} active={quick} onToggle={toggleQuick} />
            </>
          }
        />
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
