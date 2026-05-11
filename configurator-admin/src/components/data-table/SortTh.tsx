import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'

interface SortThProps {
  label:    string
  active:   boolean
  dir:      'asc' | 'desc'
  sortable: boolean
  align?:   'left' | 'right'
  onSort:   () => void
}

export function SortTh({ label, active, dir, sortable, align = 'left', onSort }: SortThProps) {
  const base = `px-4 py-3 font-medium text-muted-foreground bg-muted/40 ${align === 'right' ? 'text-right' : 'text-left'}`
  if (!sortable) {
    return <th className={base}>{label}</th>
  }
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown
  const iconCls = active ? 'h-3.5 w-3.5 ml-1 text-foreground' : 'h-3.5 w-3.5 ml-1 opacity-40'
  return (
    <th
      className={`${base} cursor-pointer select-none hover:text-foreground transition-colors`}
      onClick={onSort}
    >
      <span className={`inline-flex items-center gap-0 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <Icon className={iconCls} />
      </span>
    </th>
  )
}
