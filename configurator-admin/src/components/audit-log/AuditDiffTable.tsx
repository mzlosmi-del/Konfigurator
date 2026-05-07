import { t } from '@/i18n'
import type { AuditDiff } from '@/lib/auditLog'

interface Props {
  diff: AuditDiff | null
  /** When true, render compact one-line summary instead of a table. */
  compact?: boolean
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v) } catch { return String(v) }
}

export function AuditDiffTable({ diff, compact }: Props) {
  if (!diff || Object.keys(diff).length === 0) {
    return <span className="text-xs text-muted-foreground italic">{t('No field changes recorded')}</span>
  }
  const entries = Object.entries(diff)
  if (compact) {
    return (
      <span className="text-xs text-muted-foreground">
        {entries.map(([k]) => k).join(', ')}
      </span>
    )
  }
  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t('Field')}</th>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t('Before')}</th>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t('After')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map(([field, val]) => (
            <tr key={field}>
              <td className="px-3 py-1.5 font-medium">{field}</td>
              <td className="px-3 py-1.5 text-muted-foreground break-all">{formatValue(val.old)}</td>
              <td className="px-3 py-1.5 break-all">{formatValue(val.new)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
