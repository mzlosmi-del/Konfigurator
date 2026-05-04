import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { fetchAllProductTexts, createProductText, updateProductText, deleteProductText } from '@/lib/products'
import type { ProductText, ProductTextType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

interface Props {
  productId: string
}

const TEXT_TYPES: { value: ProductTextType; label: string }[] = [
  { value: 'product',       label: 'Product description' },
  { value: 'specification', label: 'Specification'       },
  { value: 'note',          label: 'Note'                },
  { value: 'terms',         label: 'Terms'               },
]

const LANGS = [
  { value: 'en', label: 'English' },
  { value: 'sr', label: 'Serbian' },
]

const TYPE_BADGE: Record<string, string> = {
  product:       'bg-blue-100 text-blue-700',
  specification: 'bg-violet-100 text-violet-700',
  note:          'bg-amber-100 text-amber-700',
  terms:         'bg-emerald-100 text-emerald-700',
}

const LANG_BADGE: Record<string, string> = {
  en: 'bg-gray-100 text-gray-600',
  sr: 'bg-sky-100 text-sky-700',
}

export function TextsPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [texts,     setTexts]     = useState<ProductText[]>([])
  const [loading,   setLoading]   = useState(true)

  const [addLabel,   setAddLabel]   = useState('')
  const [addContent, setAddContent] = useState('')
  const [addType,    setAddType]    = useState<ProductTextType>('product')
  const [addLang,    setAddLang]    = useState('en')
  const [adding,     setAdding]     = useState(false)

  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editLabel,   setEditLabel]   = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType,    setEditType]    = useState<ProductTextType>('product')
  const [editLang,    setEditLang]    = useState('en')
  const [saving,      setSaving]      = useState(false)

  const [toDelete,  setToDelete]  = useState<ProductText | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  useEffect(() => {
    fetchAllProductTexts(productId)
      .then(setTexts)
      .catch(() => toast({ title: t('Failed to load texts'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [productId])

  async function handleAdd() {
    if (!addLabel.trim()) {
      toast({ title: t('Label is required'), variant: 'destructive' })
      return
    }
    setAdding(true)
    try {
      const created = await createProductText({
        product_id: productId,
        label:      addLabel.trim(),
        content:    addContent.trim(),
        text_type:  addType,
        language:   addLang,
        sort_order: texts.length,
      })
      setTexts(prev => [...prev, created])
      setAddLabel('')
      setAddContent('')
      setAddType('product')
      setAddLang('en')
      toast({ title: t('Text block added') })
    } catch (e) {
      toast({ title: t('Failed to add text'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  function startEdit(text: ProductText) {
    setEditingId(text.id)
    setEditLabel(text.label)
    setEditContent(text.content)
    setEditType((text.text_type ?? 'product') as ProductTextType)
    setEditLang(text.language ?? 'en')
  }

  async function handleSaveEdit() {
    if (!editingId) return
    if (!editLabel.trim()) {
      toast({ title: t('Label is required'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const updated = await updateProductText(editingId, {
        label:     editLabel.trim(),
        content:   editContent.trim(),
        text_type: editType,
        language:  editLang,
      })
      setTexts(prev => prev.map(t => t.id === editingId ? updated : t))
      setEditingId(null)
      toast({ title: t('Text block saved') })
    } catch (e) {
      toast({ title: t('Failed to save text'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteProductText(toDelete.id)
      setTexts(prev => prev.filter(t => t.id !== toDelete.id))
      setToDelete(null)
      toast({ title: t('Text block deleted') })
    } catch (e) {
      toast({ title: t('Failed to delete text'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="space-y-4">
      {texts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('No text blocks yet. Add one below.')}</p>
      ) : (
        <div className="space-y-2">
          {texts.map(text => (
            editingId === text.id ? (
              <div key={text.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex flex-wrap gap-2">
                  <Select value={editType} onChange={e => setEditType(e.target.value as ProductTextType)} className="w-40">
                    {TEXT_TYPES.map(tt => <option key={tt.value} value={tt.value}>{t(tt.label)}</option>)}
                  </Select>
                  <Select value={editLang} onChange={e => setEditLang(e.target.value)} className="w-28">
                    {LANGS.map(l => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
                  </Select>
                  <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder={t('Label')} className="flex-1 min-w-0" />
                </div>
                <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} placeholder={t('Content...')} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} loading={saving}><Check className="h-3.5 w-3.5 mr-1" />{t('Save')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}><X className="h-3.5 w-3.5 mr-1" />{t('Cancel')}</Button>
                </div>
              </div>
            ) : (
              <div key={text.id} className="flex items-start gap-3 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGE[text.text_type] ?? ''}`}>
                      {t(TEXT_TYPES.find(tt => tt.value === text.text_type)?.label ?? text.text_type)}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${LANG_BADGE[text.language] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t(LANGS.find(l => l.value === text.language)?.label ?? text.language)}
                    </span>
                    <p className="text-sm font-medium">{text.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {text.content ? text.content.slice(0, 100) + (text.content.length > 100 ? '…' : '') : <em>{t('(empty)')}</em>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(text)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setToDelete(text)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('Add text block')}</p>
        <div className="flex flex-wrap gap-2">
          <Select value={addType} onChange={e => setAddType(e.target.value as ProductTextType)} className="w-40">
            {TEXT_TYPES.map(tt => <option key={tt.value} value={tt.value}>{t(tt.label)}</option>)}
          </Select>
          <Select value={addLang} onChange={e => setAddLang(e.target.value)} className="w-28">
            {LANGS.map(l => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
          </Select>
          <Input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder={t('e.g. Technical specs, Warranty, Note')} className="flex-1 min-w-0 w-full sm:w-auto" />
        </div>
        <Textarea value={addContent} onChange={e => setAddContent(e.target.value)} rows={4} placeholder={t('Content...')} />
        <Button size="sm" onClick={handleAdd} loading={adding} disabled={!addLabel.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />{t('Add text')}
        </Button>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => { if (!open) setToDelete(null) }}
        title={t('Delete text block')}
        description={t('This text block will be permanently deleted.')}
        confirmLabel={t('Delete')}
        onConfirm={handleDelete}
        loading={deleting}
      />
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
