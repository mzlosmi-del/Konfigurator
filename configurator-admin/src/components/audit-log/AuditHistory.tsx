import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { fetchAuditLog } from '@/lib/auditLog'
import type { AuditEntityType, AuditLog } from '@/types/database'
import { Spinner } from '@/components/ui/spinner'
import { AuditDiffTable } from './AuditDiffTable'
import { t } from '@/i18n'

interface Props {
  entityType: AuditEntityType
  entityId:   string
}

const CHANGE_LABEL: Record<AuditLog['change_type'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

export function AuditHistory({ entityType, entityId }: Props) {
  const [rows, setRows]       = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setLoading(true)
    fetchAuditLog({ entityType, entityId, limit: 200 })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
        {t('No history recorded yet.')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {rows.map(row => {
        const isOpen = !!expanded[row.id]
        return (
          <div key={row.id} className="border rounded-md">
            <button
              type="button"
              onClick={() => setExpanded(p => ({ ...p, [row.id]: !p[row.id] }))}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-left min-w-0">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <span className="font-medium shrink-0">{t(CHANGE_LABEL[row.change_type])}</span>
                <span className="text-muted-foreground text-xs truncate">
                  {new Date(row.changed_at).toLocaleString()} · {row.changed_by_name ?? t('Unknown user')}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                <AuditDiffTable diff={row.diff} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
