import { useDroppable } from '@dnd-kit/core'
import { Layers, Tag, AlertTriangle } from 'lucide-react'
import { I18nEditor } from '@/components/ui/i18n-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CharacteristicClass } from '@/types/database'
import { t } from '@/i18n'
import type { LibraryView } from './types'

interface ClassRailProps {
  classes: CharacteristicClass[]
  memberCounts: Record<string, number>
  totalCount: number
  unassignedCount: number
  activeView: LibraryView
  onSelectView: (view: LibraryView) => void

  // Inline new-class form (lifted to the container).
  showNewClass: boolean
  newClassName: string
  newClassI18n: Record<string, string>
  creatingClass: boolean
  onShowNewClass: () => void
  onNewClassNameChange: (v: string) => void
  onNewClassI18nChange: (v: Record<string, string>) => void
  onCreateClass: () => void
  onCancelNewClass: () => void
}

// Left navigation rail: pinned "All" / "Unassigned" views plus one row per
// class (each a drop target for assignment).
export function ClassRail({
  classes,
  memberCounts,
  totalCount,
  unassignedCount,
  activeView,
  onSelectView,
  showNewClass,
  newClassName,
  newClassI18n,
  creatingClass,
  onShowNewClass,
  onNewClassNameChange,
  onNewClassI18nChange,
  onCreateClass,
  onCancelNewClass,
}: ClassRailProps) {
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/20 p-2 overflow-y-auto">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t('Views')}
      </p>

      <RailButton
        active={activeView === 'all'}
        onClick={() => onSelectView('all')}
        icon={<Layers className="h-3.5 w-3.5" />}
        label={t('All characteristics')}
        count={totalCount}
      />
      <RailButton
        active={activeView === 'unassigned'}
        onClick={() => onSelectView('unassigned')}
        icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
        label={t('Unassigned')}
        count={unassignedCount}
        warn
      />

      <div className="mt-3 flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('Classes')}
        </span>
        {!showNewClass && (
          <button
            type="button"
            onClick={onShowNewClass}
            className="text-xs text-primary hover:underline"
          >
            + {t('New')}
          </button>
        )}
      </div>

      {showNewClass && (
        <div className="mb-2 rounded-md border bg-background p-2 space-y-2">
          <Input
            placeholder={t('Class name (e.g. Dimensions, Material)')}
            value={newClassName}
            onChange={e => onNewClassNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onCreateClass() }}
            autoFocus
            className="h-8 text-sm"
          />
          <I18nEditor
            value={newClassI18n}
            onChange={onNewClassI18nChange}
            placeholder={newClassName || t('Translated name')}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onCreateClass} loading={creatingClass} disabled={!newClassName.trim()}>
              {t('Create')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelNewClass}>
              {t('Cancel')}
            </Button>
          </div>
        </div>
      )}

      {classes.length === 0 && !showNewClass && (
        <p className="px-2 py-1 text-xs text-muted-foreground">{t('No classes yet.')}</p>
      )}

      {classes.map(cls => (
        <DroppableClassRow
          key={cls.id}
          cls={cls}
          count={memberCounts[cls.id] ?? 0}
          active={activeView === cls.id}
          onClick={() => onSelectView(cls.id)}
        />
      ))}
    </aside>
  )
}

function RailButton({
  active,
  onClick,
  icon,
  label,
  count,
  warn,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
  warn?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted',
        warn && !active ? 'text-amber-700' : '',
      ].join(' ')}
    >
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  )
}

// A class row that doubles as a drop target: dragging a characteristic onto it
// assigns the characteristic to that class.
function DroppableClassRow({
  cls,
  count,
  active,
  onClick,
}: {
  cls: CharacteristicClass
  count: number
  active: boolean
  onClick: () => void
}) {
  // Assignment is handled by the DndContext onDragEnd in the container; this
  // row just registers itself as a drop target and surfaces the affordance.
  const { setNodeRef, isOver, active: dragActive } = useDroppable({ id: cls.id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted',
        isOver && dragActive ? 'ring-2 ring-primary ring-offset-1' : '',
      ].join(' ')}
    >
      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate text-left">{cls.name}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  )
}
