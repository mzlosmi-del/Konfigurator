import { useState } from 'react'
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
import { GripVertical, Lock, Eye, EyeOff, FileText } from 'lucide-react'
import type { ProductText } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

export interface PdfSection {
  id:      string
  label:   string
  visible: boolean
  locked?: boolean
  textId?: string
}

interface Props {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  globalTexts:   ProductText[]
  quotationHasNotes: boolean
  onConfirm:     (sections: PdfSection[]) => void
  loading:       boolean
}

function buildDefaultSections(globalTexts: ProductText[], hasNotes: boolean): PdfSection[] {
  const sections: PdfSection[] = [
    { id: 'line-items', label: 'Line Items & Summary', visible: true, locked: true },
    { id: 'notes',      label: 'Notes',                visible: hasNotes },
    { id: 'terms',      label: 'Terms & Conditions',   visible: true },
  ]
  for (const txt of globalTexts) {
    sections.push({
      id:      `text-${txt.id}`,
      label:   txt.label,
      visible: true,
      textId:  txt.id,
    })
  }
  return sections
}

interface SortableItemProps {
  section: PdfSection
  onToggle: () => void
}

function SortableItem({ section, onToggle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id:       section.id,
    disabled: section.locked,
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
        'flex items-center gap-3 border rounded-lg px-3 py-2.5',
        section.locked  ? 'bg-muted/30'  : 'bg-background',
        !section.visible ? 'opacity-50'  : '',
      ].join(' ')}
    >
      {section.locked ? (
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
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

      <span className="flex-1 text-sm font-medium">{t(section.label)}</span>

      {section.locked ? (
        <span className="text-xs text-muted-foreground">{t('Always included')}</span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={section.visible ? 'Hide section' : 'Show section'}
        >
          {section.visible
            ? <Eye    className="h-4 w-4 text-primary" />
            : <EyeOff className="h-4 w-4" />
          }
        </button>
      )}
    </div>
  )
}

export function PdfLayoutDialog({ open, onOpenChange, globalTexts, quotationHasNotes, onConfirm, loading }: Props) {
  const [sections, setSections] = useState<PdfSection[]>(() =>
    buildDefaultSections(globalTexts, quotationHasNotes)
  )

  // Reset when dialog opens
  const [lastOpen, setLastOpen] = useState(false)
  if (open && !lastOpen) {
    setSections(buildDefaultSections(globalTexts, quotationHasNotes))
    setLastOpen(true)
  }
  if (!open && lastOpen) setLastOpen(false)

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id)
      const newIndex = prev.findIndex(s => s.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {t('Customize PDF Layout')}
          </DialogTitle>
          <DialogDescription>
            {t('Drag to reorder sections. Click the eye icon to show or hide a section.')}
          </DialogDescription>
        </DialogHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 py-1">
              {sections.map(section => (
                <SortableItem
                  key={section.id}
                  section={section}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button onClick={() => onConfirm(sections)} loading={loading}>
            <FileText className="h-4 w-4 mr-1.5" />
            {t('Generate PDF')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
