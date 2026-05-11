// Rich renderers for known JSONB diff shapes in the audit log. Keeps
// AuditDiffTable focused on layout while this module handles the
// per-shape formatting.

import type {
  QuotationLineItem,
  QuotationConfigItem,
  QuotationAdjustment,
} from '@/types/database'
import { t } from '@/i18n'

// ── Shape detection ─────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isLineItems(v: unknown): v is QuotationLineItem[] {
  if (!Array.isArray(v)) return false
  if (v.length === 0) return false
  const sample = v[0]
  return isObject(sample)
    && typeof sample.product_id   === 'string'
    && typeof sample.product_name === 'string'
    && typeof sample.quantity     === 'number'
    && typeof sample.unit_price   === 'number'
}

export function isAdjustments(v: unknown): v is QuotationAdjustment[] {
  if (!Array.isArray(v)) return false
  if (v.length === 0) return false
  const s = v[0]
  return isObject(s)
    && (s.type === 'surcharge' || s.type === 'discount' || s.type === 'tax')
    && typeof s.label === 'string'
    && (s.mode === 'percent' || s.mode === 'fixed')
    && typeof s.value === 'number'
}

export function isConfigItems(v: unknown): v is QuotationConfigItem[] {
  if (!Array.isArray(v)) return false
  if (v.length === 0) return false
  const s = v[0]
  return isObject(s)
    && typeof s.characteristic_name === 'string'
    && typeof s.value_label         === 'string'
}

/**
 * Inquiry.configuration is logged with operator-facing keys, not the
 * QuotationConfigItem shape. Detect that variant too.
 */
export function isInquiryConfigItems(
  v: unknown,
): v is { characteristic_name: string; value_label: string; price_modifier?: number }[] {
  if (!Array.isArray(v)) return false
  if (v.length === 0) return false
  const s = v[0]
  return isObject(s)
    && typeof s.characteristic_name === 'string'
    && typeof s.value_label         === 'string'
}

// ── Item-level equality (used for row highlighting) ─────────────────────────

export function shallowItemEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!isObject(a) || !isObject(b)) return false
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

// ── Render helpers ──────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2)
}
function fmtMod(n: number): string {
  return n >= 0 ? `+${fmt(n)}` : fmt(n)
}

interface RowProps {
  side:    'old' | 'new'
  status:  'same' | 'changed' | 'added' | 'removed'
  children: React.ReactNode
}

function ItemRow({ status, children }: RowProps) {
  const cls =
    status === 'added'   ? 'border-l-2 border-emerald-400 bg-emerald-50/60'
  : status === 'removed' ? 'border-l-2 border-destructive bg-destructive/5 line-through opacity-80'
  : status === 'changed' ? 'border-l-2 border-amber-400 bg-amber-50/60'
                         : 'border-l-2 border-transparent'
  return <li className={`pl-2 py-1 ${cls}`}>{children}</li>
}

// ── Public renderers ────────────────────────────────────────────────────────

interface ListProps<T> {
  items:      T[]
  otherSide:  unknown[]
  side:       'old' | 'new'
  renderItem: (item: T) => React.ReactNode
}

function diffStatus<T>(items: T[], other: unknown[], side: 'old' | 'new', idx: number): RowProps['status'] {
  const here  = items[idx]
  const there = other[idx]
  if (side === 'new') {
    if (idx >= other.length) return 'added'
    return shallowItemEqual(here, there) ? 'same' : 'changed'
  } else {
    if (idx >= other.length) return 'removed'
    return shallowItemEqual(here, there) ? 'same' : 'changed'
  }
}

function ItemList<T>({ items, otherSide, side, renderItem }: ListProps<T>) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground italic">{t('(empty)')}</span>
  }
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <ItemRow key={i} side={side} status={diffStatus(items, otherSide, side, i)}>
          {renderItem(item)}
        </ItemRow>
      ))}
    </ul>
  )
}

export function LineItemsList({ items, otherSide, side }: { items: QuotationLineItem[]; otherSide: unknown[]; side: 'old' | 'new' }) {
  return (
    <ItemList<QuotationLineItem>
      items={items}
      otherSide={otherSide}
      side={side}
      renderItem={li => {
        const lineTotal = li.quantity * li.unit_price
        const config = Array.isArray(li.configuration) ? li.configuration : []
        const adjs   = Array.isArray(li.adjustments)   ? li.adjustments   : []
        return (
          <div className="text-xs">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-foreground">{li.product_name}</span>
              {li.product_sku && (
                <span className="text-muted-foreground font-mono text-[10px]">{li.product_sku}</span>
              )}
              <span className="text-muted-foreground tabular-nums">
                {li.quantity}{li.unit_of_measure ? ` ${li.unit_of_measure}` : ''} × {fmt(li.unit_price)}
              </span>
              <span className="tabular-nums font-medium ml-auto">= {fmt(lineTotal)}</span>
            </div>
            {config.length > 0 && (
              <div className="mt-0.5 pl-3 text-muted-foreground">
                {config.map((c, i) => (
                  <div key={i}>
                    <span>{c.characteristic_name}:</span>{' '}
                    <span className="text-foreground/80">{c.value_label}</span>
                    {c.price_modifier !== 0 && (
                      <span className="ml-1 tabular-nums">({fmtMod(c.price_modifier)})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {adjs.length > 0 && (
              <div className="mt-0.5 pl-3 text-muted-foreground">
                {adjs.map((a, i) => (
                  <div key={i}>
                    — <span className="capitalize">{a.type}</span>: {a.label}{' '}
                    <span className="tabular-nums">
                      ({fmtMod(a.value)}{a.mode === 'percent' ? '%' : ''})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }}
    />
  )
}

export function AdjustmentsList({ items, otherSide, side }: { items: QuotationAdjustment[]; otherSide: unknown[]; side: 'old' | 'new' }) {
  return (
    <ItemList<QuotationAdjustment>
      items={items}
      otherSide={otherSide}
      side={side}
      renderItem={a => (
        <div className="text-xs flex items-baseline gap-2">
          <span className="capitalize text-foreground/80">{a.type}</span>
          <span className="text-muted-foreground">·</span>
          <span>{a.label}</span>
          <span className="ml-auto tabular-nums">
            {fmtMod(a.value)}{a.mode === 'percent' ? '%' : ''}
          </span>
        </div>
      )}
    />
  )
}

export function ConfigItemsList({ items, otherSide, side }: { items: QuotationConfigItem[]; otherSide: unknown[]; side: 'old' | 'new' }) {
  return (
    <ItemList<QuotationConfigItem>
      items={items}
      otherSide={otherSide}
      side={side}
      renderItem={c => (
        <div className="text-xs">
          <span>{c.characteristic_name}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="text-foreground/80">{c.value_label}</span>
          {c.price_modifier !== 0 && (
            <span className="ml-1 tabular-nums">({fmtMod(c.price_modifier)})</span>
          )}
        </div>
      )}
    />
  )
}

export function InquiryConfigList({ items, otherSide, side }: { items: { characteristic_name: string; value_label: string; price_modifier?: number }[]; otherSide: unknown[]; side: 'old' | 'new' }) {
  return (
    <ItemList
      items={items}
      otherSide={otherSide}
      side={side}
      renderItem={c => (
        <div className="text-xs">
          <span>{c.characteristic_name}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="text-foreground/80">{c.value_label}</span>
          {typeof c.price_modifier === 'number' && c.price_modifier !== 0 && (
            <span className="ml-1 tabular-nums">({fmtMod(c.price_modifier)})</span>
          )}
        </div>
      )}
    />
  )
}

// ── Generic JSON fallback ───────────────────────────────────────────────────

export function PrettyJson({ value }: { value: unknown }) {
  let text: string
  try { text = JSON.stringify(value, null, 2) }
  catch { text = String(value) }
  return (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
      {text}
    </pre>
  )
}

/**
 * Returns true when a diff value should be rendered as a multi-line
 * structured cell (and the row therefore deserves a side-by-side full-width
 * layout instead of being squeezed into a 3-column table).
 */
export function isStructuredValue(v: unknown): boolean {
  if (Array.isArray(v) && v.length > 0) return true
  if (typeof v === 'object' && v !== null) return true
  if (typeof v === 'string' && v.length > 120) return true
  return false
}
