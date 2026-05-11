import { t } from '@/i18n'
import type { AuditDiff } from '@/lib/auditLog'
import {
  isLineItems, isAdjustments, isConfigItems, isInquiryConfigItems,
  isStructuredValue,
  LineItemsList, AdjustmentsList, ConfigItemsList, InquiryConfigList,
  PrettyJson,
} from './diffRenderers'

interface Props {
  diff: AuditDiff | null
  /** When true, render compact one-line summary instead of a table. */
  compact?: boolean
}

function formatPrimitive(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string')  return v.length > 80 ? v.slice(0, 80) + '…' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function DiffCell({ value, otherSide, side }: { value: unknown; otherSide: unknown; side: 'old' | 'new' }) {
  const other = Array.isArray(otherSide) ? otherSide : []

  if (isLineItems(value)) {
    return <LineItemsList items={value} otherSide={other} side={side} />
  }
  if (isAdjustments(value)) {
    return <AdjustmentsList items={value} otherSide={other} side={side} />
  }
  // Inquiry config has the same operator-facing shape — distinct from
  // QuotationConfigItem (no characteristic_id / value_id). Try the
  // quotation shape first, then the inquiry-snapshot shape.
  if (isConfigItems(value)) {
    return <ConfigItemsList items={value} otherSide={other} side={side} />
  }
  if (isInquiryConfigItems(value)) {
    return <InquiryConfigList items={value} otherSide={other} side={side} />
  }
  // Empty array → explicit "(empty)" marker.
  if (Array.isArray(value) && value.length === 0) {
    return <span className="text-xs text-muted-foreground italic">{t('(empty)')}</span>
  }
  // Any other object/array → pretty JSON.
  if (typeof value === 'object' && value !== null) {
    return <PrettyJson value={value} />
  }
  // Long strings get a <pre> so they wrap; short ones render inline.
  if (typeof value === 'string' && value.length > 120) {
    return (
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
        {value}
      </pre>
    )
  }
  return <span>{formatPrimitive(value)}</span>
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
    <div className="border rounded-md divide-y overflow-hidden">
      {entries.map(([field, val]) => {
        const structured = isStructuredValue(val.old) || isStructuredValue(val.new)
        if (structured) {
          // Side-by-side full-width: gives long lists room to breathe.
          return (
            <div key={field} className="p-3 space-y-2">
              <div className="text-xs font-medium">{field}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('Before')}</div>
                  <div className="text-muted-foreground">
                    <DiffCell value={val.old} otherSide={val.new} side="old" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('After')}</div>
                  <div>
                    <DiffCell value={val.new} otherSide={val.old} side="new" />
                  </div>
                </div>
              </div>
            </div>
          )
        }
        // Primitive fields keep the original compact 3-column row.
        return (
          <div key={field} className="grid grid-cols-[10rem_1fr_1fr] text-xs">
            <div className="px-3 py-1.5 font-medium bg-muted/40">{field}</div>
            <div className="px-3 py-1.5 text-muted-foreground break-words">
              <DiffCell value={val.old} otherSide={val.new} side="old" />
            </div>
            <div className="px-3 py-1.5 break-words">
              <DiffCell value={val.new} otherSide={val.old} side="new" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
