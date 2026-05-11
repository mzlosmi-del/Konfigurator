import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Lock, Eye, EyeOff, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ColumnPref } from '@/lib/uiPreferences'

export interface ColumnDescriptor {
  id:     string
  label:  string
  fixed?: boolean
}

interface Props {
  open:        boolean
  onClose:     () => void
  columns:     ColumnPref[]
  descriptors: ColumnDescriptor[]
  onChange:    (columns: ColumnPref[]) => void
  onReset:     () => void
}

export function ColumnsDialog({ open, onClose, columns, descriptors, onChange, onReset }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const descById = new Map(descriptors.map(d => [d.id, d]))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = columns.findIndex(c => c.id === active.id)
    const newIdx = columns.findIndex(c => c.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    // Don't allow moving a fixed column out of its current spot (keep it pinned).
    if (descById.get(String(active.id))?.fixed) return
    onChange(arrayMove(columns, oldIdx, newIdx))
  }

  function toggle(id: string) {
    onChange(columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Columns</DialogTitle>
          <DialogDescription>
            Drag to reorder. Click the eye to show or hide a column.
          </DialogDescription>
        </DialogHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {columns.map(c => {
                const d = descById.get(c.id)
                if (!d) return null
                return (
                  <SortableRow
                    key={c.id}
                    id={c.id}
                    label={d.label}
                    visible={c.visible}
                    fixed={!!d.fixed}
                    onToggle={() => toggle(c.id)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to defaults
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface RowProps {
  id:       string
  label:    string
  visible:  boolean
  fixed:    boolean
  onToggle: () => void
}

function SortableRow({ id, label, visible, fixed, onToggle }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: fixed,
  })
  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 border rounded-md px-2.5 py-1.5',
        fixed     ? 'bg-muted/30'   : 'bg-background',
        !visible  ? 'opacity-50'    : '',
      ].join(' ')}
    >
      {fixed ? (
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <span className="flex-1 text-sm">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        disabled={fixed}
        title={fixed ? 'This column is required and cannot be hidden' : visible ? 'Hide column' : 'Show column'}
        className="text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  )
}
