import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AssignOption {
  id:    string
  label: string
}

interface Props {
  options:     AssignOption[]    // candidates that can still be assigned
  placeholder: string
  onSelect:    (id: string) => void | Promise<void>
  /** Width of the popover. Defaults to match input. */
  className?:  string
}

/**
 * Compact text-input + filtered dropdown. Press ↑/↓ to navigate, Enter to
 * pick, Esc to dismiss. Used in the Library page to assign a class to a
 * characteristic (and vice versa) by typing, as an alternative to the
 * existing drag-and-drop. After a successful assignment the input clears
 * and stays focused so several entries can be added in a row.
 */
export function AssignAutocomplete({ options, placeholder, onSelect, className }: Props) {
  const [query, setQuery]       = useState('')
  const [open,  setOpen]        = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [rect, setRect]         = useState<{ left: number; top: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 8)
    return options.filter(o => o.label.toLowerCase().includes(q)).slice(0, 8)
  }, [options, query])

  useEffect(() => { setHighlight(0) }, [query, open])

  // Anchor the portal popover to the input. Recomputed while open so it tracks
  // scroll / resize; fixed positioning lets it escape the row's overflow-hidden.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ left: r.left, top: r.bottom, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  async function pick(opt: AssignOption | undefined) {
    if (!opt) return
    await onSelect(opt.id)
    setQuery('')
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(h => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void pick(filtered[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  // The popover is rendered into document.body via a portal and positioned with
  // `fixed` coordinates so it is never clipped by the characteristic row's
  // `overflow-hidden` and always stacks above sibling rows.
  const popover = open && rect && (filtered.length > 0 || query.trim()) ? (
    <div
      style={{ position: 'fixed', left: rect.left, top: rect.top + 4, width: rect.width, zIndex: 60 }}
    >
      {filtered.length > 0 ? (
        <div className="max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
          {filtered.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              className={cn(
                'block w-full text-left text-xs px-2.5 py-1.5 truncate',
                i === highlight
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={e => e.preventDefault()}   // keep focus on input
              onClick={() => void pick(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border bg-popover shadow-lg px-2.5 py-1.5 text-xs text-muted-foreground">
          No matches
        </div>
      )}
    </div>
  ) : null

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 h-7 focus-within:ring-1 focus-within:ring-ring">
        <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-xs outline-none min-w-0 placeholder:text-muted-foreground"
        />
      </div>
      {popover && createPortal(popover, document.body)}
    </div>
  )
}
