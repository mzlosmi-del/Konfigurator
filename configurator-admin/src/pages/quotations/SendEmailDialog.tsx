import { useEffect, useMemo, useState } from 'react'
import { Paperclip } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  buildEmailHtml,
  defaultEmailSubject,
  type EmailLang,
} from '@/lib/quotationEmailTemplate'
import {
  listAttachments, formatBytes, MAX_EMAIL_BYTES,
} from '@/lib/quotationAttachments'
import type { QuotationAttachment } from '@/types/database'
import { t } from '@/i18n'

interface SendEmailDialogProps {
  open:            boolean
  onClose:         () => void
  onSent:          (sentTo: string) => void
  onError:         (msg: string) => void
  quotationId:     string
  referenceNumber: string
  customerName:    string
  customerEmail:   string
  totalPrice:      number
  currency:        string
  validUntil:      string | null
  publicUrl:       string
  tenantName:      string
  lang:            EmailLang
  defaultIntro:    string
  alreadyResent:   boolean
  /** Approx size of the generated PDF in bytes; used in the size readout. */
  pdfSizeBytes?:   number
}

export function SendEmailDialog(props: SendEmailDialogProps) {
  const {
    open, onClose, onSent, onError,
    quotationId, referenceNumber, customerName, customerEmail,
    totalPrice, currency, validUntil, publicUrl,
    tenantName, lang, defaultIntro, alreadyResent, pdfSizeBytes,
  } = props

  const [toEmail, setToEmail] = useState(customerEmail)
  const [subject, setSubject] = useState(defaultEmailSubject(lang, referenceNumber, tenantName))
  const [intro,   setIntro]   = useState(defaultIntro)
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<QuotationAttachment[]>([])

  // Pull the persisted attachments for this quotation so we can show what
  // will be bundled with the email and gate Send on the 20 MB cap.
  useEffect(() => {
    let alive = true
    listAttachments(quotationId)
      .then(rows => { if (alive) setAttachments(rows) })
      .catch(() => { /* surfaced by the panel on the detail page already */ })
    return () => { alive = false }
  }, [quotationId])

  const attachmentBytes = attachments.reduce((s, a) => s + a.size_bytes, 0)
  const totalBytes      = attachmentBytes + (pdfSizeBytes ?? 0)
  const overCap         = totalBytes > MAX_EMAIL_BYTES

  const previewHtml = useMemo(
    () => buildEmailHtml({
      tenantName,
      customerName,
      referenceNumber,
      totalPrice,
      currency,
      validUntil,
      publicUrl,
      lang,
      customIntro: intro,
    }),
    [tenantName, customerName, referenceNumber, totalPrice, currency, validUntil, publicUrl, lang, intro],
  )

  const emailValid    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim())
  const subjectValid  = subject.trim().length > 0 && subject.trim().length <= 256
  const canSend       = !sending && emailValid && subjectValid && !overCap

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-quotation-email', {
        body: {
          quotation_id:    quotationId,
          to_email:        toEmail.trim(),
          subject:         subject.trim(),
          intro_paragraph: intro,
        },
      })
      if (error) throw error
      const sentTo = (data as { sent_to?: string } | null)?.sent_to ?? toEmail.trim()
      onSent(sentTo)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !sending) onClose() }}>
      <DialogContent className="max-w-4xl w-[min(96vw,64rem)]">
        <DialogHeader>
          <DialogTitle>
            {alreadyResent ? t('Resend to customer') : t('Send to customer')}
          </DialogTitle>
          <DialogDescription>
            {t('Review and edit the email before it goes out. The PDF will be attached automatically.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5 max-h-[70vh] overflow-hidden">
          {/* Left: editable fields */}
          <div className="flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('To')}</label>
              <Input
                type="email"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                placeholder="customer@example.com"
              />
              {!emailValid && toEmail.trim().length > 0 && (
                <p className="text-xs text-destructive">{t('Invalid email address')}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('Subject')}</label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={256}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {!subjectValid && subject.trim().length === 0
                    ? t('Subject cannot be empty')
                    : ''}
                </span>
                <span>{subject.length} / 256</span>
              </div>
            </div>

            <div className="space-y-1 flex-1 min-h-0 flex flex-col">
              <label className="text-xs font-medium text-muted-foreground">
                {t('Intro paragraph')}
              </label>
              <Textarea
                value={intro}
                onChange={e => setIntro(e.target.value)}
                rows={8}
                maxLength={2000}
                placeholder={t('Optional personal note shown above the totals')}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground text-right">
                {intro.length} / 2000
              </div>
            </div>

            {/* Attachments summary */}
            <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-medium">
                <Paperclip className="h-3.5 w-3.5" />
                {t('Attachments')}
              </div>
              <ul className="space-y-0.5">
                <li className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    quotation-{referenceNumber}.pdf
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {pdfSizeBytes != null ? formatBytes(pdfSizeBytes) : '—'}
                  </span>
                </li>
                {attachments.map(a => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="truncate">{a.filename}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {formatBytes(a.size_bytes)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className={`flex justify-between pt-1.5 border-t ${overCap ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                <span>{t('Total email size')}</span>
                <span className="tabular-nums">
                  {formatBytes(totalBytes)} / {formatBytes(MAX_EMAIL_BYTES)}
                </span>
              </div>
              {overCap && (
                <p className="text-destructive">
                  {t('Email exceeds 20 MB. Remove an attachment to enable sending.')}
                </p>
              )}
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
              <div className="grid grid-cols-[7rem_1fr] gap-1">
                <span className="text-muted-foreground">{t('Reference')}</span>
                <span className="font-medium">{referenceNumber}</span>
                <span className="text-muted-foreground">{t('Total')}</span>
                <span className="font-medium">{totalPrice.toFixed(2)} {currency}</span>
                <span className="text-muted-foreground">{t('Language')}</span>
                <span className="font-medium uppercase">{lang}</span>
              </div>
              <p className="text-muted-foreground pt-1.5 border-t mt-1.5">
                {t('Reference, total and action buttons are filled in automatically and cannot be edited here.')}
              </p>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="flex flex-col gap-2 min-h-0">
            <label className="text-xs font-medium text-muted-foreground">
              {t('Preview')}
            </label>
            <div className="flex-1 min-h-0 rounded-md border overflow-hidden bg-muted/20">
              <iframe
                title={t('Email preview')}
                srcDoc={previewHtml}
                sandbox=""
                className="w-full h-full bg-white"
                style={{ minHeight: '480px' }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSend} disabled={!canSend} loading={sending}>
            {alreadyResent ? t('Resend now') : t('Send now')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
