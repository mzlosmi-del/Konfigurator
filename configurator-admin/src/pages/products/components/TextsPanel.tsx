import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { fetchProductTexts, createProductText, updateProductText, deleteProductText } from '@/lib/products'
import type { ProductText } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

interface Props {
  productId: string
}

export function TextsPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [texts,     setTexts]     = useState<ProductText[]>([])
  const [loading,   setLoading]   = useState(true)

  // Add form
  const [addLabel,   setAddLabel]   = useState('')
  const [addContent, setAddContent] = useState('')
  const [adding,     setAdding]     = useState(false)

  // Inline edit
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editLabel,   setEditLabel]   = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving,      setSaving]      = useState(false)

  // Delete
  const [toDelete,  setToDelete]  = useState<ProductText | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  useEffect(() => {
    fetchProductTexts(productId)
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
        sort_order: texts.length,
      })
      setTexts(prev => [...prev, created])
      setAddLabel('')
      setAddContent('')
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
  }

  async function handleSaveEdit() {
    if (!editingId) return
    if (!editLabel.trim()) {
      toast({ title: t('Label is required'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const updated = await updateProductText(editingId, { label: editLabel.trim(), content: editContent.trim() })
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
      {/* Existing text blocks */}
      {texts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('No text blocks yet. Add one below.')}</p>
      ) : (
        <div className="space-y-2">
          {texts.map(text => (
            editingId === text.id ? (
              <div key={text.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <Input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  placeholder={t('Label')}
                />
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{text.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {text.content ? text.content.slice(0, 100) + (text.content.length > 100 ? '…' : '') : <em>{t('(empty)')}</em>}
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
        </div>
      )}

      {/* Add new text block */}
      <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('Add text block')}</p>
        <Input
          value={addLabel}
          onChange={e => setAddLabel(e.target.value)}
          placeholder={t('e.g. Header text, Technical specs, Warranty')}
        />
        <Textarea
          value={addContent}
          onChange={e => setAddContent(e.target.value)}
          rows={4}
          placeholder={t('Content...')}
        />
        <Button size="sm" onClick={handleAdd} loading={adding} disabled={!addLabel.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t('Add text')}
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
