import { useMemo, useState, type ReactNode } from 'react'
import { Columns as ColumnsIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useTableLayout } from '@/hooks/useTableLayout'
import type { TableLayout } from '@/lib/uiPreferences'
import { SortTh } from './SortTh'
import { ColumnsDialog, type ColumnDescriptor } from './ColumnsDialog'

export const PAGE_SIZE = 50

export interface DataTableColumn<T> {
  id:         string
  label:      string
  align?:     'left' | 'right'
  sortable?:  boolean
  /** Custom sort key — defaults to the rendered string. */
  sortValue?: (row: T) => string | number | null | undefined
  render:     (row: T) => ReactNode
  width?:     string
  fixed?:     boolean
}

interface Props<T> {
  tableKey:       string
  rows:           T[]
  columns:        DataTableColumn<T>[]
  defaultLayout:  TableLayout
  loading?:       boolean
  emptyIcon?:     LucideIcon
  emptyTitle?:    string
  emptyHint?:     string
  rowKey:         (row: T) => string
  onRowOpen:      (row: T) => void
  toolbarStart?:  ReactNode
  toolbarEnd?:    ReactNode
  rowActions?:    (row: T) => ReactNode
  rowClassName?:  (row: T) => string
  footer?:        (filteredRows: T[]) => ReactNode
}

export function DataTable<T>(props: Props<T>) {
  const {
    tableKey, rows, columns, defaultLayout, loading,
    emptyIcon: EmptyIcon, emptyTitle, emptyHint,
    rowKey, onRowOpen,
    toolbarStart, toolbarEnd, rowActions, rowClassName, footer,
  } = props

  const { layout, setLayout, reset } = useTableLayout(tableKey, defaultLayout)
  const [page, setPage]             = useState(0)
  const [columnsOpen, setColumnsOpen] = useState(false)

  const columnsById = useMemo(() => {
    const m = new Map<string, DataTableColumn<T>>()
    for (const c of columns) m.set(c.id, c)
    return m
  }, [columns])

  // Compute the ordered + visible columns from saved layout.
  const visibleColumns = useMemo(() => {
    const out: DataTableColumn<T>[] = []
    for (const c of layout.columns) {
      const def = columnsById.get(c.id)
      if (def && c.visible) out.push(def)
    }
    return out
  }, [layout.columns, columnsById])

  const sortedRows = useMemo(() => {
    if (!layout.sortBy) return rows
    const col = columnsById.get(layout.sortBy)
    if (!col) return rows
    const dir = layout.sortDir === 'asc' ? 1 : -1
    const value = (r: T): string | number | null | undefined => {
      if (col.sortValue) return col.sortValue(r)
      const v = (r as Record<string, unknown>)[col.id]
      if (v == null) return null
      if (typeof v === 'string' || typeof v === 'number') return v
      return String(v)
    }
    return [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1   // nulls last regardless of dir
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [rows, layout.sortBy, layout.sortDir, columnsById])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages - 1)
  const pageRows   = sortedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const startIdx   = sortedRows.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const endIdx     = Math.min(sortedRows.length, (safePage + 1) * PAGE_SIZE)

  function handleSort(colId: string) {
    if (layout.sortBy === colId) {
      setLayout({ ...layout, sortDir: layout.sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      setLayout({ ...layout, sortBy: colId, sortDir: 'asc' })
    }
  }

  const descriptors: ColumnDescriptor[] = useMemo(
    () => columns.map(c => ({ id: c.id, label: c.label, fixed: c.fixed })),
    [columns],
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
          {toolbarStart}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {toolbarEnd}
          <Button variant="outline" size="sm" onClick={() => setColumnsOpen(true)}>
            <ColumnsIcon className="h-3.5 w-3.5 mr-1.5" />
            Columns
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : sortedRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {EmptyIcon && <EmptyIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />}
            {emptyTitle && <p className="font-medium text-sm">{emptyTitle}</p>}
            {emptyHint && <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-19rem)]">
            <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {visibleColumns.map(c => (
                    <SortTh
                      key={c.id}
                      label={c.label}
                      align={c.align}
                      sortable={!!c.sortable}
                      active={layout.sortBy === c.id}
                      dir={layout.sortDir}
                      onSort={() => c.sortable && handleSort(c.id)}
                    />
                  ))}
                  {rowActions && (
                    <th className="px-2 py-3 bg-muted/40 w-10" />
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr
                    key={rowKey(row)}
                    className={`border-t hover:bg-muted/20 transition-colors ${rowClassName?.(row) ?? ''}`}
                    onDoubleClick={() => onRowOpen(row)}
                    title="Double-click to open"
                  >
                    {visibleColumns.map(c => (
                      <td
                        key={c.id}
                        className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : ''}`}
                        style={c.width ? { width: c.width } : undefined}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-2 py-3 text-right" onDoubleClick={e => e.stopPropagation()}>
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {footer?.(sortedRows)}

          <div className="border-t bg-muted/10 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {sortedRows.length === 0
                ? 'No rows'
                : `Showing ${startIdx}–${endIdx} of ${sortedRows.length}`}
            </span>
            <div className="flex items-center gap-2">
              <span>Page {safePage + 1} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <ColumnsDialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        columns={layout.columns}
        descriptors={descriptors}
        onChange={cols => setLayout({ ...layout, columns: cols })}
        onReset={() => { reset(); setColumnsOpen(false) }}
      />
    </div>
  )
}
