// Edge Function: send-quotation-email
//
// POST { quotation_id } — emails the quotation PDF to the customer with
// View online / Accept / Reject buttons that link back to /q/:token.
//
// Auth-required (caller's JWT). The button URLs use PUBLIC_APP_URL +
// /q/<public_token>. The token is auto-assigned by the DB trigger from
// migration 067 the first time the quotation hits status 'confirmed'
// so the calling UI must run "Confirm & Generate PDF" before invoking
// this function.
//
// Self-contained — no _shared/ imports. The from-address resolver and
// HTML escape helper are inlined so the function bundles cleanly when
// deployed via the Supabase dashboard editor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_FROM = 'notifications@konfigurator.app'
const DEFAULT_APP  = 'https://app.configureout.com'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Convert ArrayBuffer → base64 string. Done in 32KB chunks so we don't
// blow the call stack on multi-MB PDFs.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunk, bytes.length))))
  }
  return btoa(binary)
}

// White-label resolver. Returns the tenant's verified address only when
// the plan includes white_label AND the domain has been verified.
async function getFromAddress(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<string> {
  const fallback = Deno.env.get('NOTIFY_FROM_EMAIL') ?? DEFAULT_FROM

  const [{ data: tenantRow }, { data: hasFeature }] = await Promise.all([
    sb.from('tenants')
      .select('email_from_address, email_from_verified')
      .eq('id', tenantId)
      .maybeSingle(),
    sb.rpc('tenant_has_feature', { p_tenant_id: tenantId, p_feature: 'white_label' }),
  ])

  if (hasFeature !== true) return fallback
  const t = tenantRow as { email_from_address: string | null; email_from_verified: boolean } | null
  if (!t?.email_from_address || !t.email_from_verified) return fallback
  return t.email_from_address
}

// ── HTML body ────────────────────────────────────────────────────────────────

interface EmailArgs {
  tenantName:      string
  customerName:    string
  referenceNumber: string
  totalPrice:      number
  currency:        string
  validUntil:      string | null
  publicUrl:       string
  lang:            'en' | 'sr'
  customIntro:     string | null
}

const COPY = {
  en: {
    subject:       (ref: string, name: string) => `${ref} — your quote from ${name}`,
    yourQuoteIs:   'Your quote is ready',
    hi:            (n: string) => `Hi ${n},`,
    reference:     'Reference',
    total:         'Total',
    validUntil:    (d: string) => `This quote is valid until ${d}.`,
    actionsHint:   'Click below to confirm or reject. PDF copy attached for your records.',
    viewOnline:    'View online',
    accept:        'Accept',
    reject:        'Reject',
  },
  sr: {
    subject:       (ref: string, name: string) => `${ref} — ponuda od ${name}`,
    yourQuoteIs:   'Vaša ponuda je spremna',
    hi:            (n: string) => `Pozdrav ${n},`,
    reference:     'Referenca',
    total:         'Ukupno',
    validUntil:    (d: string) => `Ova ponuda važi do ${d}.`,
    actionsHint:   'Kliknite ispod da prihvatite ili odbijete. PDF kopija je u prilogu.',
    viewOnline:    'Pogledaj online',
    accept:        'Prihvati',
    reject:        'Odbij',
  },
}

function buildEmailHtml(args: EmailArgs): string {
  const c           = COPY[args.lang]
  const validityRow = args.validUntil
    ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${escHtml(c.validUntil(new Date(args.validUntil).toLocaleDateString(args.lang === 'sr' ? 'sr-Latn-RS' : 'en-GB', { dateStyle: 'long' })))}</p>`
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

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey   = Deno.env.get('RESEND_API_KEY')
  const publicAppUrl   = (Deno.env.get('PUBLIC_APP_URL') ?? DEFAULT_APP).replace(/\/$/, '')
  if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: {
    quotation_id?:    string
    lang?:            string
    subject?:         string
    intro_paragraph?: string
    to_email?:        string
  }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  const quotationId = String(body?.quotation_id ?? '').trim()
  if (!quotationId) return json({ error: 'quotation_id required' }, 400)

  // Optional UI overrides — admin user can tweak Subject / Intro / To from
  // the "Send to customer" preview dialog before pressing Send.
  const subjectOverride = typeof body.subject === 'string'
    ? body.subject.trim().slice(0, 256)
    : null
  const introOverride = typeof body.intro_paragraph === 'string'
    ? body.intro_paragraph.slice(0, 2000)
    : null
  const toOverride = typeof body.to_email === 'string' ? body.to_email.trim() : null
  if (toOverride && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toOverride)) {
    return json({ error: 'Invalid to_email' }, 400)
  }

  // ── Load quotation through user client (RLS enforces tenancy) ─────────────
  const { data: quotation, error: qErr } = await userClient
    .from('quotations')
    .select('id, tenant_id, reference_number, customer_name, customer_email, currency, total_price, valid_until, status, pdf_url, public_token, lang')
    .eq('id', quotationId)
    .single()
  if (qErr || !quotation) return json({ error: 'Quotation not found' }, 404)

  // Lang lives on the quotation (set during Confirm & Generate PDF). Body
  // override is accepted for backwards compat with old callers.
  const lang: 'en' | 'sr' = body?.lang === 'sr' || quotation.lang === 'sr' ? 'sr' : 'en'

  if (!quotation.customer_email) {
    return json({ error: 'Quotation has no customer email' }, 400)
  }
  if (!quotation.pdf_url) {
    return json({ error: 'PDF not generated yet — confirm the quotation first' }, 400)
  }
  if (!quotation.public_token) {
    return json({ error: 'Quotation token missing — re-confirm to assign one' }, 400)
  }
  if (quotation.status !== 'confirmed' && quotation.status !== 'sent') {
    return json({ error: `Cannot send a quotation in status "${quotation.status}"` }, 400)
  }

  // ── Service-role for tenant lookup + from-address resolver ────────────────
  const sb = createClient(supabaseUrl, serviceRoleKey)
  const fromEmail = await getFromAddress(sb, quotation.tenant_id)

  const { data: tenant } = await sb
    .from('tenants')
    .select('name')
    .eq('id', quotation.tenant_id)
    .single()
  const tenantRow = tenant as { name: string } | null
  const tenantName  = tenantRow?.name ?? 'Your store'

  // Look up the `quotation_email_intro` slot from `tenant_texts` (migration
  // 076). Falls back to the other language when the chosen one is empty.
  const { data: introRows } = await sb
    .from('tenant_texts')
    .select('language, content')
    .eq('tenant_id', quotation.tenant_id)
    .eq('level', 'tenant')
    .is('reference_id', null)
    .eq('slot', 'quotation_email_intro')
  const introList = (introRows ?? []) as { language: string; content: string }[]
  const introByLang = (l: string) => introList.find(r => r.language === l && r.content.trim())?.content ?? null
  const tenantIntro = introByLang(lang) ?? introByLang(lang === 'en' ? 'sr' : 'en')
  // Per-send override (from the preview dialog) wins over the tenant default.
  const customIntro = introOverride !== null ? introOverride : tenantIntro

  // ── Fetch PDF bytes ───────────────────────────────────────────────────────
  let pdfBytes: ArrayBuffer
  try {
    const pdfRes = await fetch(quotation.pdf_url)
    if (!pdfRes.ok) {
      return json({ error: 'Failed to fetch stored PDF', detail: pdfRes.statusText }, 502)
    }
    pdfBytes = await pdfRes.arrayBuffer()
  } catch (e) {
    return json({ error: 'Failed to fetch stored PDF', detail: String(e) }, 502)
  }
  const pdfBase64 = arrayBufferToBase64(pdfBytes)

  // ── Extra attachments persisted on the quotation ─────────────────────────
  // 20 MB total cap (PDF + all extra attachments) keeps every email under
  // the size most receiving servers will accept and matches the limit we
  // surface in the admin UI.
  const MAX_EMAIL_BYTES = 20 * 1024 * 1024
  const extraAttachments: { filename: string; content: string }[] = []
  let totalBytes = pdfBytes.byteLength

  const { data: attachmentRows } = await sb
    .from('quotation_attachments')
    .select('storage_path, filename, size_bytes')
    .eq('quotation_id', quotation.id)
  const rows = (attachmentRows ?? []) as { storage_path: string; filename: string; size_bytes: number }[]

  // Cheap up-front cap check using stored sizes.
  totalBytes += rows.reduce((s, r) => s + Number(r.size_bytes || 0), 0)
  if (totalBytes > MAX_EMAIL_BYTES) {
    return json({
      error:       'Email exceeds 20 MB size limit',
      total_bytes: totalBytes,
      max_bytes:   MAX_EMAIL_BYTES,
    }, 413)
  }

  // Download each attachment through the service-role storage client and
  // base64-encode it for Resend.
  for (const row of rows) {
    const { data: blob, error: dlErr } = await sb.storage
      .from('quotation-attachments')
      .download(row.storage_path)
    if (dlErr || !blob) {
      console.error('send-quotation-email attachment download failed', row.storage_path, dlErr)
      return json({ error: 'Failed to fetch attachment', filename: row.filename }, 502)
    }
    const buf = await blob.arrayBuffer()
    extraAttachments.push({
      filename: row.filename,
      content:  arrayBufferToBase64(buf),
    })
  }

  // ── Build + send ──────────────────────────────────────────────────────────
  const publicUrl = `${publicAppUrl}/q/${quotation.public_token}`
  const html      = buildEmailHtml({
    tenantName,
    customerName:    quotation.customer_name,
    referenceNumber: quotation.reference_number,
    totalPrice:      quotation.total_price,
    currency:        quotation.currency,
    validUntil:      quotation.valid_until,
    publicUrl,
    lang,
    customIntro,
  })
  const subject = subjectOverride && subjectOverride.length > 0
    ? subjectOverride
    : COPY[lang].subject(quotation.reference_number, tenantName)
  const toEmail = toOverride ?? quotation.customer_email

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    fromEmail,
      to:      [toEmail],
      subject,
      html,
      attachments: [
        {
          filename: `quotation-${quotation.reference_number}.pdf`,
          content:  pdfBase64,
        },
        ...extraAttachments,
      ],
    }),
  })

  if (!emailRes.ok) {
    const text = await emailRes.text()
    console.error('send-quotation-email Resend error', text)
    return json({ error: 'Resend send failed', detail: text }, 502)
  }

  // Flip status to 'sent'. Idempotent on resend — the row was already
  // 'sent' in that case so this just bumps updated_at.
  await sb
    .from('quotations')
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', quotation.id)

  return json({ ok: true, sent_to: toEmail, public_url: publicUrl })
})
