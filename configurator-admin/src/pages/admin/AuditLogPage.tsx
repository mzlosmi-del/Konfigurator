import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { fetchAuditLog } from '@/lib/auditLog'
import type { AuditEntityType, AuditLog } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { AuditDiffTable } from '@/components/audit-log/AuditDiffTable'
import { useAuthContext } from '@/components/auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import { t } from '@/i18n'

const ENTITY_TYPES: { value: AuditEntityType | 'all'; label: string }[] = [
  { value: 'all',                 label: 'All entities' },
  { value: 'product',             label: 'Product' },
  { value: 'characteristic',      label: 'Characteristic' },
  { value: 'characteristic_value', label: 'Characteristic value' },
  { value: 'class',               label: 'Class' },
  { value: 'pricing_schedule',    label: 'Pricing' },
  { value: 'pricing_formula',     label: 'Formula' },
  { value: 'product_text',        label: 'Product text' },
  { value: 'global_text',         label: 'Global text' },
  { value: 'settings',            label: 'Settings' },
  { value: 'quotation',           label: 'Quotation' },
]

const CHANGE_LABEL: Record<AuditLog['change_type'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

const CHANGE_VARIANT: Record<AuditLog['change_type'], 'success' | 'secondary' | 'destructive'> = {
  create: 'success',
  update: 'secondary',
  delete: 'destructive',
}

const PAGE_SIZE = 50

export function AuditLogPage() {
  const { toasts, toast, dismiss } = useToast()
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [rows, setRows]         = useState<AuditLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(0)
  const [hasMore, setHasMore]   = useState(false)

  const [entityType, setEntityType] = useState<AuditEntityType | 'all'>('all')
  const [fromDate, setFromDate]     = useState('')
  const [toDate, setToDate]         = useState('')
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({})

  // Admin guard
  useEffect(() => {
    if (profile && profile.role !== 'admin') navigate('/dashboard', { replace: true })
  }, [profile, navigate])

  async function load(p = 0) {
    setLoading(true)
    try {
      const data = await fetchAuditLog({
        entityType: entityType === 'all' ? undefined : entityType,
        fromDate:   fromDate ? new Date(fromDate).toISOString() : undefined,
        toDate:     toDate   ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
        limit:      PAGE_SIZE + 1,
        offset:     p * PAGE_SIZE,
      })
      setHasMore(data.length > PAGE_SIZE)
      setRows(data.slice(0, PAGE_SIZE))
      setPage(p)
    } catch (e) {
      toast({ title: t('Failed to load audit log'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0) }, [entityType, fromDate, toDate])

  const entityLabelMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of ENTITY_TYPES) m[e.value] = e.label
    return m
  }, [])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Audit log')}
        description={t('Recent changes across products, pricing, texts, settings, and quotations. Retained for 90 days.')}
      />

      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-3 md:p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('Entity type')}</label>
              <Select
                value={entityType}
                onChange={e => setEntityType(e.target.value as AuditEntityType | 'all')}
                className="w-48"
              >
                {ENTITY_TYPES.map(e => (
                  <option key={e.value} value={e.value}>{t(e.label)}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('From')}</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('To')}</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
            </div>
            {(entityType !== 'all' || fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEntityType('all'); setFromDate(''); setToDate('') }}
              >
                {t('Clear filters')}
              </Button>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">{t('No log entries match your filters.')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('When')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('User')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('Entity')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('Name')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('Change')}</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('Fields')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map(row => {
                      const isOpen = !!expanded[row.id]
                      return (
                        <>
                          <tr
                            key={row.id}
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => setExpanded(p => ({ ...p, [row.id]: !p[row.id] }))}
                          >
                            <td className="px-3 py-2 text-muted-foreground">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">
                              {new Date(row.changed_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row.changed_by_name ?? <span className="text-muted-foreground italic">{t('Unknown')}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {t(entityLabelMap[row.entity_type] ?? row.entity_type)}
                            </td>
                            <td className="px-3 py-2 max-w-xs truncate">
                              {row.entity_name ?? <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={CHANGE_VARIANT[row.change_type]}>{t(CHANGE_LABEL[row.change_type])}</Badge>
                            </td>
                            <td className="px-3 py-2 max-w-md">
                              <AuditDiffTable diff={row.diff} compact />
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${row.id}-detail`} className="bg-muted/10">
                              <td></td>
                              <td colSpan={6} className="px-3 py-3">
                                <AuditDiffTable diff={row.diff} />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('Page')} {page + 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => load(page - 1)}
                >
                  {t('Previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => load(page + 1)}
                >
                  {t('Next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
