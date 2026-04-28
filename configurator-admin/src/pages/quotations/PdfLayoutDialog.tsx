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
  id:            string
  label:         string
  visible:       boolean
  locked?:       boolean
  textId?:       string   // global text block ID
  productTextId?: string  // product text entry ID
  productId?:    string   // owning product (for productTextId sections)
  group?:        string   // display group label shown below the section title
}

export interface ProductTextGroup {
  productId:   string
  productName: string
  texts:       ProductText[]
}

interface Props {
  open:              boolean
  onOpenChange:      (open: boolean) => void
  globalTexts:       ProductText[]
  productTexts?:     ProductTextGroup[]
  quotationHasNotes: boolean
  onConfirm:         (sections: PdfSection[], lang: 'en' | 'sr') => void
  loading:           boolean
}

function buildDefaultSections(
  globalTexts: ProductText[],
  hasNotes: boolean,
  productTexts?: ProductTextGroup[],
): PdfSection[] {
  const sections: PdfSection[] = [
    { id: 'line-items', label: 'Line Items & Summary', visible: true, locked: true },
  ]

  // One toggleable row per product text entry (rendered inline within each line item)
  for (const { productId, productName, texts } of (productTexts ?? [])) {
    for (const pt of texts) {
      sections.push({
        id:            `pt-${pt.id}`,
        label:         pt.label,
        visible:       true,
        productTextId: pt.id,
        productId,
        group:         productName,
      })
    }
  }

  sections.push({ id: 'notes', label: 'Notes', visible: hasNotes })
  sections.push({ id: 'terms', label: 'Terms & Conditions', visible: true })

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
        'flex items-center gap-3 border rounded-lg px-3 py-2',
        section.locked   ? 'bg-muted/30'  : 'bg-background',
        !section.visible ? 'opacity-50'   : '',
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

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{t(section.label)}</span>
        {section.group && (
          <p className="text-xs text-muted-foreground truncate">{section.group}</p>
        )}
      </div>

      {section.locked ? (
        <span className="text-xs text-muted-foreground shrink-0">{t('Always included')}</span>
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

export function PdfLayoutDialog({ open, onOpenChange, globalTexts, productTexts, quotationHasNotes, onConfirm, loading }: Props) {
  const [sections, setSections] = useState<PdfSection[]>(() =>
    buildDefaultSections(globalTexts, quotationHasNotes, productTexts)
  )
  const [lang, setLang] = useState<'en' | 'sr'>('en')

  // Reset when dialog opens
  const [lastOpen, setLastOpen] = useState(false)
  if (open && !lastOpen) {
    setSections(buildDefaultSections(globalTexts, quotationHasNotes, productTexts))
    setLang('en')
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

        <div className="flex items-center gap-2 pb-1">
          <span className="text-xs font-medium text-muted-foreground">{t('PDF Language')}:</span>
          <div className="flex rounded-md border overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 transition-colors ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'}`}
            >
              {t('English')}
            </button>
            <button
              type="button"
              onClick={() => setLang('sr')}
              className={`px-3 py-1 transition-colors border-l ${lang === 'sr' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'}`}
            >
              {t('Serbian')}
            </button>
          </div>
        </div>

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
          <Button onClick={() => onConfirm(sections, lang)} loading={loading}>
            <FileText className="h-4 w-4 mr-1.5" />
            {t('Generate PDF')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
