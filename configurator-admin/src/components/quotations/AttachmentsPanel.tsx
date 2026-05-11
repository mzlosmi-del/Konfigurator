import { useEffect, useRef, useState } from 'react'
import { Paperclip, Trash2, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  listAttachments, uploadAttachment, deleteAttachment,
  formatBytes, MAX_EMAIL_BYTES,
} from '@/lib/quotationAttachments'
import type { QuotationAttachment } from '@/types/database'
import { useToast } from '@/hooks/useToast'
import { logChange } from '@/lib/auditLog'
import { useAuthContext } from '@/components/auth/AuthContext'
import { t } from '@/i18n'

interface Props {
  quotationId:     string
  tenantId:        string
  referenceNumber: string
  canEdit:         boolean
  /** Optional PDF size to include in the total-size readout. */
  pdfSizeBytes?:   number
  /** Called when the list of attachments changes (add/remove). */
  onChange?:       (attachments: QuotationAttachment[]) => void
}

export function AttachmentsPanel({
  quotationId, tenantId, referenceNumber, canEdit, pdfSizeBytes, onChange,
}: Props) {
  const { toast } = useToast()
  const { profile } = useAuthContext()
  const userName = profile?.email ?? null
  const inputRef = useRef<HTMLInputElement>(null)

  const [items,   setItems]   = useState<QuotationAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    listAttachments(quotationId)
      .then(rows => { if (alive) { setItems(rows); onChange?.(rows) } })
      .catch(() => toast({ title: t('Failed to load attachments'), variant: 'destructive' }))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId])

  const attachmentBytes = items.reduce((s, a) => s + a.size_bytes, 0)
  const totalBytes      = attachmentBytes + (pdfSizeBytes ?? 0)
  const overCap         = totalBytes > MAX_EMAIL_BYTES
  const usagePct        = Math.min(100, (totalBytes / MAX_EMAIL_BYTES) * 100)

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same file
    if (files.length === 0) return

    // Per-file cap and projected total cap.
    let runningTotal = totalBytes
    for (const f of files) {
      if (f.size > MAX_EMAIL_BYTES) {
        toast({
          title:       t('File too large'),
          description: `${f.name} · ${formatBytes(f.size)} > ${formatBytes(MAX_EMAIL_BYTES)}`,
          variant:     'destructive',
        })
        return
      }
      runningTotal += f.size
    }
    if (runningTotal > MAX_EMAIL_BYTES) {
      toast({
        title:       t('Attachments would exceed the 20 MB email cap'),
        description: `${formatBytes(runningTotal)} / ${formatBytes(MAX_EMAIL_BYTES)}`,
        variant:     'destructive',
      })
      return
    }

    setBusy(true)
    const before = items.map(a => a.filename)
    try {
      for (const f of files) {
        const att = await uploadAttachment(quotationId, tenantId, f)
        setItems(prev => {
          const next = [...prev, att]
          onChange?.(next)
          return next
        })
      }
      const after = (await listAttachments(quotationId)).map(a => a.filename)
      logChange({
        entityType:    'quotation',
        entityId:      quotationId,
        entityName:    referenceNumber,
        changeType:    'update',
        diff:          { [t('Attachments')]: { old: before, new: after } },
        changedByName: userName,
      })
    } catch (err) {
      toast({ title: t('Upload failed'), description: String(err), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(att: QuotationAttachment) {
    setBusy(true)
    const before = items.map(a => a.filename)
    try {
      await deleteAttachment(att)
      const next = items.filter(a => a.id !== att.id)
      setItems(next)
      onChange?.(next)
      logChange({
        entityType:    'quotation',
        entityId:      quotationId,
        entityName:    referenceNumber,
        changeType:    'update',
        diff:          { [t('Attachments')]: { old: before, new: next.map(a => a.filename) } },
        changedByName: userName,
      })
    } catch (err) {
      toast({ title: t('Failed to remove attachment'), description: String(err), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const barColor = overCap ? 'bg-destructive'
                 : totalBytes > MAX_EMAIL_BYTES * 0.75 ? 'bg-amber-500'
                 : 'bg-primary'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Paperclip className="h-4 w-4" />
              {t('Attachments')}
            </CardTitle>
            <CardDescription>
              {t('Files attached here are bundled into the customer email.')}
            </CardDescription>
          </div>
          {canEdit && (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handlePick}
                disabled={busy}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {t('Add files')}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('No attachments.')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map(att => (
              <li key={att.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 truncate">{att.filename}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatBytes(att.size_bytes)}
                </span>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleRemove(att)}
                    disabled={busy}
                    title={t('Remove')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Total size readout */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {t('Email size')}
              {pdfSizeBytes != null && ` (${t('PDF')} + ${t('attachments')})`}
            </span>
            <span className={overCap ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {formatBytes(totalBytes)} / {formatBytes(MAX_EMAIL_BYTES)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${barColor}`} style={{ width: `${usagePct}%` }} />
          </div>
          {overCap && (
            <p className="text-xs text-destructive">
              {t('Email exceeds 20 MB. Remove an attachment to enable sending.')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
