// Edge Function: send-quotation-email
//
// POST { quotation_id } — emails the quotation PDF to the customer with
// View online / Accept / Reject buttons that link back to /q/:token.
//
// Auth-required (caller's JWT). The button URLs use PUBLIC_APP_URL +
// /q/<public_token>. The token is auto-assigned by the DB trigger from
// migration 067 the first time the quotation hits status confirmed_sent,
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
  let body: { quotation_id?: string; lang?: string }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  const quotationId = String(body?.quotation_id ?? '').trim()
  if (!quotationId) return json({ error: 'quotation_id required' }, 400)
  const lang: 'en' | 'sr' = body?.lang === 'sr' ? 'sr' : 'en'

  // ── Load quotation through user client (RLS enforces tenancy) ─────────────
  const { data: quotation, error: qErr } = await userClient
    .from('quotations')
    .select('id, tenant_id, reference_number, customer_name, customer_email, currency, total_price, valid_until, status, pdf_url, public_token')
    .eq('id', quotationId)
    .single()
  if (qErr || !quotation) return json({ error: 'Quotation not found' }, 404)

  if (!quotation.customer_email) {
    return json({ error: 'Quotation has no customer email' }, 400)
  }
  if (!quotation.pdf_url) {
    return json({ error: 'PDF not generated yet — confirm the quotation first' }, 400)
  }
  if (!quotation.public_token) {
    return json({ error: 'Quotation token missing — re-confirm to assign one' }, 400)
  }
  if (quotation.status !== 'confirmed_sent') {
    return json({ error: `Cannot send a quotation in status "${quotation.status}"` }, 400)
  }

  // ── Service-role for tenant lookup + from-address resolver ────────────────
  const sb = createClient(supabaseUrl, serviceRoleKey)
  const fromEmail = await getFromAddress(sb, quotation.tenant_id)

  const { data: tenant } = await sb
    .from('tenants').select('name').eq('id', quotation.tenant_id).single()
  const tenantName = (tenant as { name: string } | null)?.name ?? 'Your store'

  // ── Fetch PDF bytes ───────────────────────────────────────────────────────
  let pdfBase64: string
  try {
    const pdfRes = await fetch(quotation.pdf_url)
    if (!pdfRes.ok) {
      return json({ error: 'Failed to fetch stored PDF', detail: pdfRes.statusText }, 502)
    }
    pdfBase64 = arrayBufferToBase64(await pdfRes.arrayBuffer())
  } catch (e) {
    return json({ error: 'Failed to fetch stored PDF', detail: String(e) }, 502)
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
  })
  const subject   = COPY[lang].subject(quotation.reference_number, tenantName)

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    fromEmail,
      to:      [quotation.customer_email],
      subject,
      html,
      attachments: [{
        filename: `quotation-${quotation.reference_number}.pdf`,
        content:  pdfBase64,
      }],
    }),
  })

  if (!emailRes.ok) {
    const text = await emailRes.text()
    console.error('send-quotation-email Resend error', text)
    return json({ error: 'Resend send failed', detail: text }, 502)
  }

  return json({ ok: true, sent_to: quotation.customer_email, public_url: publicUrl })
})
