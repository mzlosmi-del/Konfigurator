import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Check, X, GripVertical } from 'lucide-react'
import {
  fetchGlobalTexts,
  createProductText,
  updateProductText,
  deleteProductText,
} from '@/lib/products'
import type { ProductText, ProductTextType } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

// text types that are global (not tied to a product)
const GLOBAL_TYPES: ProductTextType[] = ['note', 'terms']
const ALL_TYPES: { value: ProductTextType; label: string; description: string }[] = [
  { value: 'product',       label: 'Product description', description: 'Printed under the product row in PDF line items'         },
  { value: 'specification', label: 'Specification',       description: 'Printed in line items as specs'                          },
  { value: 'note',          label: 'Note',                description: 'Appears as a separate section in the PDF (global or per-product)' },
  { value: 'terms',         label: 'Terms',               description: 'Appears as terms & conditions section in the PDF'        },
]

const TYPE_BADGE: Record<string, string> = {
  product:       'bg-blue-100 text-blue-700',
  specification: 'bg-violet-100 text-violet-700',
  note:          'bg-amber-100 text-amber-700',
  terms:         'bg-emerald-100 text-emerald-700',
}

export function TextsPage() {
  const { toasts, toast, dismiss } = useToast()

  const [globalTexts, setGlobalTexts] = useState<ProductText[]>([])
  const [loading,     setLoading]     = useState(true)

  const [showAdd,     setShowAdd]     = useState(false)
  const [addLabel,    setAddLabel]    = useState('')
  const [addContent,  setAddContent]  = useState('')
  const [addType,     setAddType]     = useState<ProductTextType>('note')
  const [adding,      setAdding]      = useState(false)

  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editLabel,   setEditLabel]   = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType,    setEditType]    = useState<ProductTextType>('note')
  const [saving,      setSaving]      = useState(false)

  const [toDelete,  setToDelete]  = useState<ProductText | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  useEffect(() => {
    fetchGlobalTexts()
      .then(texts => {
        setGlobalTexts(texts)
      })
      .catch(() => toast({ title: t('Failed to load texts'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!addLabel.trim()) {
      toast({ title: t('Label is required'), variant: 'destructive' })
      return
    }
    setAdding(true)
    try {
      const created = await createProductText({
        product_id: null,
        label:      addLabel.trim(),
        content:    addContent.trim(),
        text_type:  addType,
        sort_order: globalTexts.length,
      })
      setGlobalTexts(prev => [...prev, created])
      setAddLabel('')
      setAddContent('')
      setAddType('note')
      setShowAdd(false)
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
    setEditType((text.text_type ?? 'note') as ProductTextType)
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
      })
      setGlobalTexts(prev => prev.map(t => t.id === editingId ? updated : t))
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
      setGlobalTexts(prev => prev.filter(t => t.id !== toDelete.id))
      setToDelete(null)
      toast({ title: t('Text block deleted') })
    } catch (e) {
      toast({ title: t('Failed to delete text'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="animate-fade-in">
      <PageHeader title={t('Texts')} />
      <div className="flex justify-center py-16"><Spinner /></div>
    </div>
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Texts')}
        description={t('Global text blocks included in PDF quotations. Product-specific texts are managed in the product editor.')}
      />

      <div className="p-6 space-y-6 max-w-3xl">

        {/* Type legend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('Text Types')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {ALL_TYPES.map(tt => (
              <div key={tt.value} className="flex items-start gap-2">
                <span className={`mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${TYPE_BADGE[tt.value]}`}>
                  {t(tt.label)}
                </span>
                <p className="text-xs text-muted-foreground">{t(tt.description)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Global texts list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Global Text Blocks')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('Add text block')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {showAdd && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/10 mb-4">
                <div className="flex gap-2">
                  <Select
                    value={addType}
                    onChange={e => setAddType(e.target.value as ProductTextType)}
                    className="w-40"
                  >
                    {GLOBAL_TYPES.map(v => (
                      <option key={v} value={v}>{t(ALL_TYPES.find(t => t.value === v)?.label ?? v)}</option>
                    ))}
                  </Select>
                  <Input
                    value={addLabel}
                    onChange={e => setAddLabel(e.target.value)}
                    placeholder={t('Label')}
                    className="flex-1"
                  />
                </div>
                <Textarea
                  value={addContent}
                  onChange={e => setAddContent(e.target.value)}
                  rows={4}
                  placeholder={t('Content...')}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} loading={adding} disabled={!addLabel.trim()}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t('Add')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} disabled={adding}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    {t('Cancel')}
                  </Button>
                </div>
              </div>
            )}

            {globalTexts.length === 0 && !showAdd && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('No global text blocks yet.')}
              </p>
            )}

            {globalTexts.map(text => (
              editingId === text.id ? (
                <div key={text.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex gap-2">
                    <Select
                      value={editType}
                      onChange={e => setEditType(e.target.value as ProductTextType)}
                      className="w-40"
                    >
                      {GLOBAL_TYPES.map(v => (
                        <option key={v} value={v}>{t(ALL_TYPES.find(t => t.value === v)?.label ?? v)}</option>
                      ))}
                    </Select>
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder={t('Label')}
                      className="flex-1"
                    />
                  </div>
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={4}
                    placeholder={t('Content...')}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} loading={saving}>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t('Save')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      {t('Cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={text.id} className="flex items-start gap-3 border rounded-lg p-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGE[text.text_type] ?? ''}`}>
                        {t(ALL_TYPES.find(tt => tt.value === text.text_type)?.label ?? text.text_type)}
                      </span>
                      <p className="text-sm font-medium">{text.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {text.content ? text.content.slice(0, 120) + (text.content.length > 120 ? '…' : '') : <em>{t('(empty)')}</em>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(text)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setToDelete(text)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            ))}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground px-1">
          {t('Product-specific texts (Product description, Specification) are managed in each product\'s Texts tab.')}
        </p>
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
