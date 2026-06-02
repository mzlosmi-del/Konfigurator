import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, Type, Heading, Table2, Image as ImageIcon,
  Minus, MoveVertical, Repeat, Box, ListTree, Download, GripVertical,
  SeparatorHorizontal, ChevronUp, ChevronDown,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from '@/components/ui/toast'
import { useToast } from '@/hooks/useToast'
import { useCanEdit } from '@/hooks/usePermission'
import { t } from '@/i18n'
import type { Block, BlockKind, DocumentTemplateDefinition, PageOptions } from '@/lib/docTemplate/types'
import { buildTemplateContext } from '@/lib/docTemplate/context'
import { fetchTemplate, updateTemplate, type DocumentTemplateRow } from '@/lib/docTemplate/templates'
import { renderTemplateToPdf } from '@/lib/docTemplate/renderPdf'
import { renderTemplateToDocx } from '@/lib/docTemplate/renderDocx'
import { renderTemplateToXlsx } from '@/lib/docTemplate/renderXlsx'
import { downloadBytes } from '@/lib/docTemplate/download'
import { quotation, tenant, texts } from '@/__fixtures__/quotationFixture'
import { TemplateCanvas } from './TemplateCanvas'
import { BlockProperties } from './BlockProperties'
import {
  makeBlock, updateBlock, removeBlock, addBlock, findBlock, activeScopesFor,
  moveBlock, reorderSiblings, parentIdOf,
} from './treeOps'

const PALETTE: { kind: BlockKind; label: string; Icon: typeof Type }[] = [
  { kind: 'heading',          label: 'Heading',     Icon: Heading },
  { kind: 'text',             label: 'Text',        Icon: Type },
  { kind: 'key-value',        label: 'Key / value', Icon: ListTree },
  { kind: 'line-items-table', label: 'Items table', Icon: Table2 },
  { kind: 'image',            label: 'Image',       Icon: ImageIcon },
  { kind: 'repeater',         label: 'Repeater',    Icon: Repeat },
  { kind: 'group',            label: 'Group',       Icon: Box },
  { kind: 'divider',          label: 'Divider',     Icon: Minus },
  { kind: 'spacer',           label: 'Spacer',      Icon: MoveVertical },
  { kind: 'page-break',       label: 'Page break',  Icon: SeparatorHorizontal },
]

export function TemplateBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canEdit = useCanEdit('settings')
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]   = useState(true)
  const [row, setRow]           = useState<DocumentTemplateRow | null>(null)
  const [name, setName]         = useState('')
  const [blocks, setBlocks]     = useState<Block[]>([])
  const [page, setPage]         = useState<PageOptions>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewLang, setPreviewLang] = useState<'en' | 'sr'>('en')
  const [saving, setSaving]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dirty, setDirty]       = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchTemplate(id)
      .then(r => { setRow(r); setName(r.name); setBlocks(r.definition.blocks ?? []); setPage(r.definition.page ?? {}) })
      .catch(err => toast({ title: t('Failed to load template'), description: String(err), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id, toast])

  // Live preview context against the bundled fixture in the chosen language.
  const ctx = useMemo(
    () => buildTemplateContext(quotation, tenant, texts, previewLang),
    [previewLang],
  )

  function mutate(next: Block[]) {
    setBlocks(next)
    setDirty(true)
  }

  function handleAdd(kind: BlockKind) {
    const block = makeBlock(kind)
    // Add into the selected block if it's a container, else top level.
    const sel = selectedId ? findBlock(blocks, selectedId) : undefined
    const parentId = sel && (sel.kind === 'repeater' || sel.kind === 'group') ? sel.id : null
    mutate(addBlock(blocks, parentId, block))
    setSelectedId(block.id)
  }

  function handlePatch(patch: Partial<Block>) {
    if (!selectedId) return
    mutate(updateBlock(blocks, selectedId, patch))
  }

  function handleDelete() {
    if (!selectedId) return
    mutate(removeBlock(blocks, selectedId))
    setSelectedId(null)
  }

  function handleMove(blockId: string, dir: 'up' | 'down') {
    mutate(moveBlock(blocks, blockId, dir))
  }

  function handleReorder(fromId: string, toId: string) {
    if (fromId === toId) return
    // Only reorder when both blocks share a parent (dnd is per-sibling-list).
    const parent = parentIdOf(blocks, fromId)
    if (parent === undefined || parent !== parentIdOf(blocks, toId)) return
    mutate(reorderSiblings(blocks, parent, fromId, toId))
  }

  function setPageOpt(patch: Partial<PageOptions>) {
    setPage(p => ({ ...p, ...patch }))
    setDirty(true)
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    try {
      const definition: DocumentTemplateDefinition = { version: 1, blocks, page }
      const updated = await updateTemplate(id, { name: name.trim() || t('Untitled'), definition })
      setRow(updated)
      setDirty(false)
      toast({ title: t('Template saved') })
    } catch (err) {
      toast({ title: t('Failed to save template'), description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleExportSample() {
    if (!row) return
    setExporting(true)
    try {
      const definition: DocumentTemplateDefinition = { version: 1, blocks, page }
      const args = { definition, quotation, tenant, texts, lang: previewLang }
      const fileBase = `${(name || 'template').replace(/\s+/g, '_')}_sample`
      if (row.output_kind === 'pdf')  downloadBytes(await renderTemplateToPdf(args),  'pdf',  fileBase)
      else if (row.output_kind === 'docx') downloadBytes(await renderTemplateToDocx(args), 'docx', fileBase)
      else downloadBytes(await renderTemplateToXlsx(args), 'xlsx', fileBase)
    } catch (err) {
      toast({ title: t('Failed to export'), description: String(err), variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!row) return <div className="p-6">{t('Template not found.')}</div>

  const selectedBlock = selectedId ? findBlock(blocks, selectedId) : undefined
  const selectedScopes = selectedId ? (activeScopesFor(blocks, selectedId) ?? undefined) : undefined

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <button onClick={() => navigate('/templates')} className="text-muted-foreground hover:text-foreground" aria-label={t('Back')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Input value={name} disabled={!canEdit} onChange={e => { setName(e.target.value); setDirty(true) }} className="max-w-xs font-medium" />
        <span className="text-xs uppercase text-muted-foreground">{row.output_kind}</span>
        <div className="flex-1" />
        <div className="flex rounded-md border overflow-hidden text-xs font-medium mr-2">
          {(['en', 'sr'] as const).map(l => (
            <button key={l} onClick={() => setPreviewLang(l)}
              className={`px-3 py-1 ${previewLang === l ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={handleExportSample} loading={exporting}>
          <Download className="h-4 w-4 mr-1.5" />{t('Export sample')}
        </Button>
        {canEdit && (
          <Button onClick={handleSave} loading={saving} disabled={!dirty}>
            <Save className="h-4 w-4 mr-1.5" />{t('Save')}
          </Button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: palette + tree */}
        <div className="w-64 shrink-0 border-r flex flex-col overflow-y-auto">
          {canEdit && (
            <div className="p-3 border-b">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('Add block')}</p>
              <div className="grid grid-cols-3 gap-1">
                {PALETTE.map(({ kind, label, Icon }) => (
                  <button key={kind} onClick={() => handleAdd(kind)} title={t(label)}
                    className="flex flex-col items-center gap-1 border rounded-md py-2 text-[10px] hover:bg-muted/50 transition-colors">
                    <Icon className="h-4 w-4" />
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {canEdit && (
            <div className="p-3 border-b">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('Page')}</p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!!page.footer} onChange={e => setPageOpt({ footer: e.target.checked })} />
                {t('Footer with page numbers')}
              </label>
              {page.footer && (
                <Input
                  className="mt-2 h-8 text-xs"
                  value={page.footerLabel ?? ''}
                  placeholder={t('Footer label (default: company name)')}
                  onChange={e => setPageOpt({ footerLabel: e.target.value })}
                />
              )}
              <label className="flex items-center gap-2 text-xs mt-2">
                <input type="checkbox" checked={!!page.numbering} onChange={e => setPageOpt({ numbering: e.target.checked })} />
                {t('Number headings (1, 1.1, 1.1.1)')}
              </label>
            </div>
          )}
          <div className="p-3 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('Structure')}</p>
            <TreeView
              blocks={blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={canEdit ? handleMove : undefined}
              onReorder={canEdit ? handleReorder : undefined}
              sensors={sensors}
              depth={0}
            />
          </div>
        </div>

        {/* Middle: properties */}
        <div className="w-80 shrink-0 border-r overflow-y-auto p-4">
          {selectedBlock && selectedScopes ? (
            <BlockProperties
              block={selectedBlock}
              scopes={selectedScopes}
              readOnly={!canEdit}
              onChange={handlePatch}
              onDelete={handleDelete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('Select a block to edit its properties.')}</p>
          )}
        </div>

        {/* Right: live preview */}
        <div className="flex-1 overflow-y-auto bg-[#E8E9EC] flex justify-center py-6 px-4">
          <TemplateCanvas blocks={blocks} ctx={ctx} page={page} selectedId={selectedId ?? undefined} onSelectBlock={setSelectedId} />
        </div>
      </div>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── Tree view — drag-to-reorder within a sibling list (@dnd-kit) plus ▲/▼
//    buttons. Drag is scoped per sibling list; cross-parent moves aren't
//    supported in v1 (use add-into-selected + delete to restructure). ──

interface TreeProps {
  blocks:     Block[]
  selectedId: string | null
  onSelect:   (id: string) => void
  onMove?:    (id: string, dir: 'up' | 'down') => void
  onReorder?: (fromId: string, toId: string) => void
  sensors:    ReturnType<typeof useSensors>
  depth:      number
}

function TreeView({ blocks, selectedId, onSelect, onMove, onReorder, sensors, depth }: TreeProps) {
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) onReorder?.(String(active.id), String(over.id))
  }

  const list = (
    <div className="space-y-0.5">
      {blocks.map((block, i) => (
        <TreeRow
          key={block.id}
          block={block}
          index={i}
          count={blocks.length}
          selectedId={selectedId}
          onSelect={onSelect}
          onMove={onMove}
          onReorder={onReorder}
          sensors={sensors}
          depth={depth}
          draggable={!!onReorder}
        />
      ))}
      {blocks.length === 0 && depth === 0 && (
        <p className="text-xs text-muted-foreground italic px-2 py-1">{t('Empty — add a block above.')}</p>
      )}
    </div>
  )

  if (!onReorder) return list
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {list}
      </SortableContext>
    </DndContext>
  )
}

function TreeRow({ block, index, count, selectedId, onSelect, onMove, onReorder, sensors, depth, draggable }: {
  block: Block; index: number; count: number; draggable: boolean
} & Omit<TreeProps, 'blocks'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: !draggable })
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const isContainer = block.kind === 'repeater' || block.kind === 'group'

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={[
          'group/row w-full flex items-center gap-1 text-xs rounded px-1 py-1 transition-colors',
          block.id === selectedId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50',
        ].join(' ')}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {draggable ? (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground shrink-0" aria-label={t('Drag to reorder')}>
            <GripVertical className="h-3 w-3" />
          </button>
        ) : <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />}

        <button onClick={() => onSelect(block.id)} className="flex-1 text-left capitalize truncate">
          {block.kind.replace('-', ' ')}
        </button>

        {onMove && (
          <span className="flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button onClick={() => onMove(block.id, 'up')} disabled={index === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5" aria-label={t('Move up')}>
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={() => onMove(block.id, 'down')} disabled={index === count - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5" aria-label={t('Move down')}>
              <ChevronDown className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>

      {isContainer && (
        <TreeView
          blocks={block.children}
          selectedId={selectedId}
          onSelect={onSelect}
          onMove={onMove}
          onReorder={onReorder}
          sensors={sensors}
          depth={depth + 1}
        />
      )}
    </div>
  )
}
