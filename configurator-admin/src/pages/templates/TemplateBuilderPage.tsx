import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, Type, Heading, Table2, Image as ImageIcon,
  Minus, MoveVertical, Repeat, Box, ListTree, Download, GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from '@/components/ui/toast'
import { useToast } from '@/hooks/useToast'
import { useCanEdit } from '@/hooks/usePermission'
import { t } from '@/i18n'
import type { Block, BlockKind, DocumentTemplateDefinition } from '@/lib/docTemplate/types'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewLang, setPreviewLang] = useState<'en' | 'sr'>('en')
  const [saving, setSaving]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dirty, setDirty]       = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchTemplate(id)
      .then(r => { setRow(r); setName(r.name); setBlocks(r.definition.blocks ?? []) })
      .catch(err => toast({ title: t('Failed to load template'), description: String(err), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id])

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

  async function handleSave() {
    if (!id) return
    setSaving(true)
    try {
      const definition: DocumentTemplateDefinition = { version: 1, blocks }
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
      const definition: DocumentTemplateDefinition = { version: 1, blocks }
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
          <div className="p-3 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('Structure')}</p>
            <TreeView blocks={blocks} selectedId={selectedId} onSelect={setSelectedId} depth={0} />
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
          <TemplateCanvas blocks={blocks} ctx={ctx} selectedId={selectedId ?? undefined} onSelectBlock={setSelectedId} />
        </div>
      </div>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── Tree view (flat indented list; selection only — reordering is via the
//    add-into-selected flow and delete; full drag-reorder is a later polish) ──

function TreeView({ blocks, selectedId, onSelect, depth }: {
  blocks: Block[]; selectedId: string | null; onSelect: (id: string) => void; depth: number
}) {
  return (
    <div className="space-y-0.5">
      {blocks.map(block => (
        <div key={block.id}>
          <button
            onClick={() => onSelect(block.id)}
            style={{ paddingLeft: 8 + depth * 14 }}
            className={[
              'w-full flex items-center gap-1.5 text-left text-xs rounded px-2 py-1 transition-colors',
              block.id === selectedId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50',
            ].join(' ')}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="capitalize truncate">{block.kind.replace('-', ' ')}</span>
          </button>
          {(block.kind === 'repeater' || block.kind === 'group') && (
            <TreeView blocks={block.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          )}
        </div>
      ))}
      {blocks.length === 0 && depth === 0 && (
        <p className="text-xs text-muted-foreground italic px-2 py-1">{t('Empty — add a block above.')}</p>
      )}
    </div>
  )
}
