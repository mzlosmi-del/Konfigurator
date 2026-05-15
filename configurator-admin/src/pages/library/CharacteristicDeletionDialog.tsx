import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  previewCharacteristicDeletion,
  type CharacteristicDeletionPreview,
} from '@/lib/products'
import { t } from '@/i18n'

interface Props {
  open:         boolean
  onOpenChange: (open: boolean) => void
  characteristicId: string | null
  /** Called only after the user confirms in this dialog. The parent then runs
   *  `deleteCharacteristicCascade` and closes the dialog. */
  onConfirm:    () => Promise<void>
  deleting:     boolean
}

function NamePreview({ items, max = 4 }: { items: { name?: string; label?: string }[]; max?: number }) {
  if (items.length === 0) return null
  const names = items.map(it => it.name ?? it.label ?? '').filter(Boolean)
  const head  = names.slice(0, max)
  const more  = names.length - head.length
  return (
    <span className="text-xs text-muted-foreground">
      {head.join(', ')}{more > 0 ? `, +${more} ${t('more')}` : ''}
    </span>
  )
}

function Row({ count, label, names, danger }: {
  count:  number
  label:  string
  names?: { name?: string; label?: string }[]
  danger?: boolean
}) {
  if (count === 0) return null
  return (
    <li className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${danger ? 'text-destructive font-medium' : 'text-foreground'}`}>
          {label}
        </div>
        {names && names.length > 0 && <NamePreview items={names} />}
      </div>
      <span className={`shrink-0 text-sm tabular-nums font-semibold ${danger ? 'text-destructive' : 'text-muted-foreground'}`}>
        {count}
      </span>
    </li>
  )
}

export function CharacteristicDeletionDialog({
  open, onOpenChange, characteristicId, onConfirm, deleting,
}: Props) {
  const [preview, setPreview] = useState<CharacteristicDeletionPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!open || !characteristicId) {
      setPreview(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    previewCharacteristicDeletion(characteristicId)
      .then(p => { if (!cancelled) setPreview(p) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, characteristicId])

  const totalImpact = preview
    ? preview.values.length
      + preview.characteristicTextRows + preview.valueTextRows
      + preview.affectedRules.length + preview.affectedFormulas.length
      + preview.attachedProducts.length + preview.attachedClasses.length
      + preview.detachedAssets
    : 0

  return (
    <Dialog open={open} onOpenChange={open => !deleting && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t('Delete characteristic?')}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? <>
                  <span className="font-medium text-foreground">"{preview.characteristic.name}"</span>{' '}
                  {t('will be deleted along with everything below. Quotations and inquiries you have already created keep their original snapshot and are not affected.')}
                </>
              : t('Checking what would be removed…')}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 mt-2">
            {error}
          </div>
        )}

        {preview && !loading && (
          <ul className="rounded-md border bg-muted/20 px-3 py-1 mt-2">
            <Row
              count={preview.values.length}
              label={preview.values.length === 1 ? t('Value (with its price modifier)') : t('Values (with their price modifiers)')}
              names={preview.values}
              danger
            />
            <Row
              count={preview.characteristicTextRows}
              label={t('Centralised text rows for this characteristic')}
              danger
            />
            <Row
              count={preview.valueTextRows}
              label={t('Centralised text rows for its values')}
              danger
            />
            <Row
              count={preview.affectedRules.length}
              label={t('Configuration rules that reference it')}
              names={preview.affectedRules.map(r => ({ name: r.product_name }))}
              danger
            />
            <Row
              count={preview.affectedFormulas.length}
              label={t('Pricing formulas that reference it')}
              names={preview.affectedFormulas.map(f => ({ name: `${f.name} (${f.product_name})` }))}
              danger
            />
            <Row
              count={preview.attachedProducts.length}
              label={t('Products it is attached to (relationship removed)')}
              names={preview.attachedProducts}
            />
            <Row
              count={preview.attachedClasses.length}
              label={t('Classes it belongs to (membership removed)')}
              names={preview.attachedClasses}
            />
            <Row
              count={preview.detachedAssets}
              label={t('Visualization images that will be detached')}
            />
            {totalImpact === 0 && (
              <li className="py-3 text-sm text-muted-foreground text-center">
                {t('Nothing else references this characteristic.')}
              </li>
            )}
          </ul>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            {t('Cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={deleting}
            disabled={loading || !!error || !preview}
          >
            {t('Delete characteristic')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
