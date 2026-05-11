import { cn } from '@/lib/utils'

export interface QuickFilter {
  id:    string
  label: string
}

interface Props {
  filters:  QuickFilter[]
  active:   string[]
  onToggle: (id: string) => void
}

export function QuickFilterChips({ filters, active, onToggle }: Props) {
  if (filters.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {filters.map(f => {
        const on = active.includes(f.id)
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle(f.id)}
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              on
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-input hover:text-foreground hover:bg-accent',
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
