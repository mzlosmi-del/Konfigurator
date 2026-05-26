import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutTemplate, Plus, Trash2, FileText, FileType2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { useAuthContext } from '@/components/auth/AuthContext'
import { useCanEdit } from '@/hooks/usePermission'
import { t, getLang } from '@/i18n'
import { listTemplates, createTemplate, deleteTemplate, type DocumentTemplateRow } from '@/lib/docTemplate/templates'
import { TEMPLATE_PRESETS, presetById } from '@/lib/docTemplate/presets'
import type { OutputKind } from '@/lib/docTemplate/types'

const KIND_ICON: Record<OutputKind, typeof FileText> = {
  pdf:  FileText,
  docx: FileType2,
  xlsx: FileSpreadsheet,
}

export function TemplatesPage() {
  const { tenant } = useAuthContext()
  const canEdit = useCanEdit('settings')
  const { toasts, toast, dismiss } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading]   = useState(true)
  const [rows, setRows]         = useState<DocumentTemplateRow[]>([])
  const [newName, setNewName]   = useState('')
  const [newKind, setNewKind]   = useState<OutputKind>('pdf')
  const [newPreset, setNewPreset] = useState<string>('blank')
  const [creating, setCreating] = useState(false)
  const uiLang = getLang()

  /** Selecting a preset suggests its default output kind (still editable). */
  function handlePresetChange(presetId: string) {
    setNewPreset(presetId)
    const p = presetById(presetId)
    if (p) setNewKind(p.output)
  }
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await listTemplates())
    } catch (err) {
      toast({ title: t('Failed to load templates'), description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!newName.trim() || !tenant) return
    setCreating(true)
    try {
      const preset = presetById(newPreset) ?? TEMPLATE_PRESETS[0]
      const row = await createTemplate({
        tenant_id:   tenant.id,
        name:        newName.trim(),
        output_kind: newKind,
        definition:  preset.make(),
      })
      setNewName('')
      navigate(`/templates/${row.id}`)
    } catch (err) {
      toast({ title: t('Failed to create template'), description: String(err), variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteTemplate(deleteId)
      setDeleteId(null)
      await load()
      toast({ title: t('Template deleted') })
    } catch (err) {
      toast({ title: t('Failed to delete template'), description: String(err), variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t('Custom document templates')}</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        {t('Design your own document layouts that render to PDF, Word and Excel. These are an additional output option — your existing quotation exports are unchanged.')}
      </p>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 border rounded-lg p-4 bg-muted/20">
          <div className="flex-1 min-w-48">
            <label className="text-xs font-medium text-muted-foreground">{t('New template name')}</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('e.g. Branded quotation')} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('Start from')}</label>
            <Select value={newPreset} onChange={e => handlePresetChange(e.target.value)} className="w-48">
              {TEMPLATE_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.label[uiLang] ?? p.label.en}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('Output')}</label>
            <Select value={newKind} onChange={e => setNewKind(e.target.value as OutputKind)} className="w-28">
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
            </Select>
          </div>
          <Button onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1.5" />{t('Create')}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('No custom templates yet.')}</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const Icon = KIND_ICON[row.output_kind]
            return (
              <div key={row.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <button className="flex-1 text-left min-w-0" onClick={() => navigate(`/templates/${row.id}`)}>
                  <div className="font-medium truncate">{row.name}</div>
                  <div className="text-xs text-muted-foreground uppercase">{row.output_kind}</div>
                </button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/templates/${row.id}`)}>
                  {canEdit ? t('Edit') : t('View')}
                </Button>
                {canEdit && (
                  <button
                    className="text-muted-foreground hover:text-destructive p-1"
                    onClick={() => setDeleteId(row.id)}
                    aria-label={t('Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
        title={t('Delete template?')}
        description={t('This cannot be undone.')}
        confirmLabel={t('Delete')}
        onConfirm={handleDelete}
      />
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
