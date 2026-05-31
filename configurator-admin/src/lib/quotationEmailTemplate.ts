// Client-side mirror of the email template used by
// supabase/functions/send-quotation-email/index.ts so the "Send to customer"
// preview dialog renders the exact same HTML the customer will receive.
//
// IMPORTANT: keep this in sync with buildEmailHtml() / COPY in the edge
// function. The reference/totals/buttons block is generated — only the
// subject, recipient and intro paragraph are operator-editable.

import type { OutputLang } from '@/lib/languages'
import { labelsFor } from '@/lib/pdf/shared'

export type EmailLang = OutputLang

export interface EmailPreviewArgs {
  tenantName:      string
  customerName:    string
  referenceNumber: string
  totalPrice:      number
  currency:        string
  validUntil:      string | null
  publicUrl:       string
  lang:            EmailLang
  customIntro:     string | null
}

interface Copy {
  subject:     (ref: string, name: string) => string
  yourQuoteIs: string
  hi:          (n: string) => string
  reference:   string
  total:       string
  validUntil:  (d: string) => string
  actionsHint: string
  viewOnline:  string
  accept:      string
  reject:      string
}

export const EMAIL_COPY: Record<EmailLang, Copy> = {
  en: {
    subject:     (ref, name) => `${ref} — your quote from ${name}`,
    yourQuoteIs: 'Your quote is ready',
    hi:          n => `Hi ${n},`,
    reference:   'Reference',
    total:       'Total',
    validUntil:  d => `This quote is valid until ${d}.`,
    actionsHint: 'Click below to confirm or reject. PDF copy attached for your records.',
    viewOnline:  'View online',
    accept:      'Accept',
    reject:      'Reject',
  },
  sr: {
    subject:     (ref, name) => `${ref} — ponuda od ${name}`,
    yourQuoteIs: 'Vaša ponuda je spremna',
    hi:          n => `Pozdrav ${n},`,
    reference:   'Referenca',
    total:       'Ukupno',
    validUntil:  d => `Ova ponuda važi do ${d}.`,
    actionsHint: 'Kliknite ispod da prihvatite ili odbijete. PDF kopija je u prilogu.',
    viewOnline:  'Pogledaj online',
    accept:      'Prihvati',
    reject:      'Odbij',
  },
  de: {
    subject:     (ref, name) => `${ref} — Ihr Angebot von ${name}`,
    yourQuoteIs: 'Ihr Angebot ist fertig',
    hi:          n => `Hallo ${n},`,
    reference:   'Referenz',
    total:       'Gesamt',
    validUntil:  d => `Dieses Angebot ist gültig bis ${d}.`,
    actionsHint: 'Klicken Sie unten, um zu bestätigen oder abzulehnen. Eine PDF-Kopie ist beigefügt.',
    viewOnline:  'Online ansehen',
    accept:      'Annehmen',
    reject:      'Ablehnen',
  },
  fr: {
    subject:     (ref, name) => `${ref} — votre devis de ${name}`,
    yourQuoteIs: 'Votre devis est prêt',
    hi:          n => `Bonjour ${n},`,
    reference:   'Référence',
    total:       'Total',
    validUntil:  d => `Ce devis est valable jusqu’au ${d}.`,
    actionsHint: 'Cliquez ci-dessous pour confirmer ou refuser. Une copie PDF est jointe.',
    viewOnline:  'Voir en ligne',
    accept:      'Accepter',
    reject:      'Refuser',
  },
  es: {
    subject:     (ref, name) => `${ref} — su presupuesto de ${name}`,
    yourQuoteIs: 'Su presupuesto está listo',
    hi:          n => `Hola ${n},`,
    reference:   'Referencia',
    total:       'Total',
    validUntil:  d => `Este presupuesto es válido hasta ${d}.`,
    actionsHint: 'Haga clic abajo para confirmar o rechazar. Se adjunta una copia en PDF.',
    viewOnline:  'Ver en línea',
    accept:      'Aceptar',
    reject:      'Rechazar',
  },
  ru: {
    subject:     (ref, name) => `${ref} — ваше предложение от ${name}`,
    yourQuoteIs: 'Ваше предложение готово',
    hi:          n => `Здравствуйте, ${n},`,
    reference:   'Номер',
    total:       'Итого',
    validUntil:  d => `Это предложение действительно до ${d}.`,
    actionsHint: 'Нажмите ниже, чтобы принять или отклонить. Копия в формате PDF прилагается.',
    viewOnline:  'Открыть онлайн',
    accept:      'Принять',
    reject:      'Отклонить',
  },
}

/** Safe accessor — email copy for `lang`, falling back to English. */
function emailCopy(lang: EmailLang): Copy {
  return EMAIL_COPY[lang] ?? EMAIL_COPY.en
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildEmailHtml(args: EmailPreviewArgs): string {
  const c           = emailCopy(args.lang)
  const validityRow = args.validUntil
    ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${escHtml(c.validUntil(new Date(args.validUntil).toLocaleDateString(labelsFor(args.lang).dateLocale, { dateStyle: 'long' })))}</p>`
    : ''
  const introRow    = args.customIntro && args.customIntro.trim().length > 0
    ? `<p style="margin:12px 0 0;font-size:14px;color:#374151;line-height:1.55;white-space:pre-line;">${escHtml(args.customIntro.trim())}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="${args.lang}">
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
        <tr><td style="padding:32px 28px;">
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">${escHtml(args.tenantName)}</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${escHtml(c.yourQuoteIs)}</h1>
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">${escHtml(c.hi(args.customerName))}</p>
          ${introRow}
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 0;width:100%;border-top:1px solid #e5e7eb;">
            <tr>
              <td style="padding:12px 0;font-size:13px;color:#6b7280;width:100px;">${escHtml(c.reference)}</td>
              <td style="padding:12px 0;font-size:14px;color:#111827;font-weight:600;">${escHtml(args.referenceNumber)}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="padding:12px 0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">${escHtml(c.total)}</td>
              <td style="padding:12px 0;font-size:14px;color:#111827;font-weight:600;border-top:1px solid #e5e7eb;">${args.totalPrice.toFixed(2)} ${escHtml(args.currency)}</td>
            </tr>
          </table>
          ${validityRow}
          <p style="margin:24px 0 12px;font-size:13px;color:#6b7280;">${escHtml(c.actionsHint)}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
            <tr>
              <td align="center" style="padding:4px;">
                <a href="${escHtml(args.publicUrl)}" style="display:inline-block;padding:11px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${escHtml(c.viewOnline)}</a>
              </td>
              <td align="center" style="padding:4px;">
                <a href="${escHtml(args.publicUrl)}?action=accept" style="display:inline-block;padding:11px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${escHtml(c.accept)}</a>
              </td>
              <td align="center" style="padding:4px;">
                <a href="${escHtml(args.publicUrl)}?action=reject" style="display:inline-block;padding:11px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${escHtml(c.reject)}</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">${escHtml(args.tenantName)}</p>
    </td></tr>
  </table>
</body></html>`
}

export function defaultEmailSubject(
  lang: EmailLang,
  referenceNumber: string,
  tenantName: string,
): string {
  return emailCopy(lang).subject(referenceNumber, tenantName)
}
