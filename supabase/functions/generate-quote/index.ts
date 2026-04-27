import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1'
import { loadPlanLimits, makePlanError, gateForbidden } from '../_shared/planGate.ts'

// ── Types ──────────────────────────────────────────────────────────────────

interface ConfigLineItem {
  characteristic_name: string
  value_label: string
  price_modifier: number
}

interface InquiryRow {
  id: string
  tenant_id: string
  product_id: string
  customer_name: string
  customer_email: string
  message: string | null
  configuration: ConfigLineItem[]
  total_price: number | null
  currency: string
  created_at: string
}

interface ProductRow { name: string }
interface TenantRow  { name: string }

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey   = Deno.env.get('RESEND_API_KEY')!
  const fromEmail      = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'notifications@konfigurator.app'

  // ── 1. Verify caller is an authenticated admin ──────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── 2. Parse request body ───────────────────────────────────────────────
  let inquiry_id: string
  let expires_at: string | null
  try {
    const body = await req.json()
    inquiry_id = body.inquiry_id
    expires_at = body.expires_at ?? null
    if (!inquiry_id) throw new Error('missing inquiry_id')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  if (!resendApiKey) {
    console.error('generate-quote: RESEND_API_KEY not set')
    return new Response('Email provider not configured', { status: 500 })
  }

  // Service-role client bypasses RLS for data fetching
  const sb = createClient(supabaseUrl, serviceRoleKey)

  try {
    // ── 3. Fetch inquiry ──────────────────────────────────────────────────
    const { data: inquiryData, error: inqErr } = await sb
      .from('inquiries')
      .select('id, tenant_id, product_id, customer_name, customer_email, message, configuration, total_price, currency, created_at')
      .eq('id', inquiry_id)
      .single()

    if (inqErr || !inquiryData) {
      console.error('generate-quote: inquiry not found', inqErr)
      return new Response('Inquiry not found', { status: 404 })
    }
    const inq = inquiryData as InquiryRow

    // ── 4. Fetch product & tenant ─────────────────────────────────────────
    const [{ data: productData }, { data: tenantData }] = await Promise.all([
      sb.from('products').select('name').eq('id', inq.product_id).single(),
      sb.from('tenants').select('name').eq('id', inq.tenant_id).single(),
    ])

    const productName = (productData as ProductRow | null)?.name ?? 'Unknown product'
    const tenantName  = (tenantData as TenantRow | null)?.name ?? 'Your store'

    // ── Plan gate: quotations feature ─────────────────────────────────────
    const limits = await loadPlanLimits(sb, inq.tenant_id)
    if (!limits) return new Response('Tenant not found', { status: 404 })
    if (!limits.quotations) {
      return gateForbidden(makePlanError('quotations', limits.plan))
    }

    // ── 5. Generate PDF ───────────────────────────────────────────────────
    const pdfBytes = await buildQuotePdf({
      tenantName,
      productName,
      inquiry: inq,
      expiresAt: expires_at,
    })

    // ── 6. Upload PDF to Supabase Storage ─────────────────────────────────
    const quoteId  = crypto.randomUUID()
    const filePath = `${inq.tenant_id}/${quoteId}.pdf`

    const { error: uploadErr } = await sb.storage
      .from('quotes')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadErr) {
      console.error('generate-quote: storage upload failed', uploadErr)
      return new Response('Failed to store PDF', { status: 500 })
    }

    const { data: { publicUrl } } = sb.storage.from('quotes').getPublicUrl(filePath)

    // ── 7. Insert quotes row ──────────────────────────────────────────────
    const { data: quoteRow, error: insertErr } = await sb
      .from('quotes')
      .insert({
        id:         quoteId,
        inquiry_id: inq.id,
        tenant_id:  inq.tenant_id,
        pdf_url:    publicUrl,
        expires_at: expires_at ?? null,
        status:     'sent',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('generate-quote: quote insert failed', insertErr)
      return new Response('Failed to save quote record', { status: 500 })
    }

    // ── 8. Send email to customer via Resend ──────────────────────────────
    const config = Array.isArray(inq.configuration) ? inq.configuration : []
    const html   = buildEmailHtml({ tenantName, productName, inquiry: inq, expiresAt: expires_at, pdfUrl: publicUrl })

    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes))

    const emailRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [inq.customer_email],
        subject: `Your quote for ${productName}`,
        html,
        attachments: [
          {
            filename: `quote-${quoteId.slice(0, 8)}.pdf`,
            content:  pdfBase64,
          },
        ],
      }),
    })

    if (!emailRes.ok) {
      const body = await emailRes.text()
      console.error('generate-quote: Resend error', emailRes.status, body)
      // Don't fail the whole request — quote is saved, just email bounced
      console.warn('generate-quote: email failed but quote was saved')
    } else {
      console.log(`generate-quote: quote ${quoteId} sent to ${inq.customer_email}`)
    }

    return new Response(JSON.stringify({ quote_id: quoteId, pdf_url: publicUrl, ...quoteRow }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('generate-quote: unexpected error', err)
    return new Response('Internal error', { status: 500 })
  }
})

// ── PDF Generation ─────────────────────────────────────────────────────────

async function buildQuotePdf({
  tenantName,
  productName,
  inquiry,
  expiresAt,
}: {
  tenantName:  string
  productName: string
  inquiry:     InquiryRow
  expiresAt:   string | null
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([595, 842]) // A4

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 56
  const col    = width - margin * 2

  // ── Colours ────────────────────────────────────────────────────────────
  const black    = rgb(0.067, 0.067, 0.067)
  const muted    = rgb(0.45,  0.45,  0.45)
  const faint    = rgb(0.88,  0.88,  0.88)
  const accent   = rgb(0.145, 0.337, 0.922) // blue-600
  const positive = rgb(0.055, 0.604, 0.408)
  const negative = rgb(0.847, 0.208, 0.208)

  let y = height - margin

  // ── Helper: draw a horizontal rule ─────────────────────────────────────
  function rule(yPos: number, color = faint) {
    page.drawLine({
      start: { x: margin, y: yPos },
      end:   { x: width - margin, y: yPos },
      thickness: 0.5,
      color,
    })
  }

  // ── Header ─────────────────────────────────────────────────────────────
  // Tenant name (top-left)
  page.drawText(tenantName.toUpperCase(), {
    x: margin, y,
    size: 9, font: fontBold, color: muted,
  })

  // "QUOTE" label (top-right)
  page.drawText('QUOTE', {
    x: width - margin - fontBold.widthOfTextAtSize('QUOTE', 22),
    y,
    size: 22, font: fontBold, color: black,
  })

  y -= 28

  // Issue date
  const issueDate = new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })
  page.drawText(`Issued: ${issueDate}`, { x: margin, y, size: 9, font: fontRegular, color: muted })

  if (expiresAt) {
    const expDate = new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })
    const expText = `Valid until: ${expDate}`
    page.drawText(expText, {
      x: width - margin - fontRegular.widthOfTextAtSize(expText, 9),
      y,
      size: 9, font: fontRegular, color: muted,
    })
  }

  y -= 18
  rule(y)
  y -= 24

  // ── Prepared for ───────────────────────────────────────────────────────
  page.drawText('PREPARED FOR', { x: margin, y, size: 8, font: fontBold, color: muted })
  y -= 16
  page.drawText(inquiry.customer_name, { x: margin, y, size: 13, font: fontBold, color: black })
  y -= 14
  page.drawText(inquiry.customer_email, { x: margin, y, size: 10, font: fontRegular, color: accent })
  y -= 28

  rule(y)
  y -= 24

  // ── Product ────────────────────────────────────────────────────────────
  page.drawText('PRODUCT', { x: margin, y, size: 8, font: fontBold, color: muted })
  y -= 16
  page.drawText(productName, { x: margin, y, size: 14, font: fontBold, color: black })
  y -= 32

  // ── Configuration table ────────────────────────────────────────────────
  const config = Array.isArray(inquiry.configuration) ? inquiry.configuration : []

  if (config.length > 0) {
    page.drawText('CONFIGURATION', { x: margin, y, size: 8, font: fontBold, color: muted })
    y -= 16

    // Table header background
    page.drawRectangle({ x: margin, y: y - 4, width: col, height: 22, color: rgb(0.96, 0.97, 0.98) })

    page.drawText('Option',   { x: margin + 8,     y, size: 9, font: fontBold, color: muted })
    page.drawText('Selected', { x: margin + col * 0.45, y, size: 9, font: fontBold, color: muted })
    const modHeader = 'Modifier'
    page.drawText(modHeader, {
      x: margin + col - fontBold.widthOfTextAtSize(modHeader, 9) - 8,
      y,
      size: 9, font: fontBold, color: muted,
    })
    y -= 22

    for (const item of config) {
      // Alternating row shading
      page.drawRectangle({ x: margin, y: y - 4, width: col, height: 20, color: rgb(1, 1, 1) })

      page.drawText(item.characteristic_name, { x: margin + 8,     y, size: 10, font: fontRegular, color: black })
      page.drawText(item.value_label,          { x: margin + col * 0.45, y, size: 10, font: fontBold,    color: black })

      if (item.price_modifier !== 0) {
        const sign    = item.price_modifier > 0 ? '+' : ''
        const modText = `${sign}${item.price_modifier.toFixed(2)}`
        const modColor = item.price_modifier > 0 ? positive : negative
        page.drawText(modText, {
          x: margin + col - fontBold.widthOfTextAtSize(modText, 10) - 8,
          y,
          size: 10, font: fontBold, color: modColor,
        })
      }

      y -= 22
      rule(y + 2, rgb(0.93, 0.93, 0.93))
    }
    y -= 10
  }

  // ── Total ──────────────────────────────────────────────────────────────
  if (inquiry.total_price != null) {
    rule(y)
    y -= 20

    page.drawText('TOTAL', { x: margin, y, size: 10, font: fontBold, color: muted })

    const totalText = `${inquiry.total_price.toFixed(2)} ${inquiry.currency}`
    page.drawText(totalText, {
      x: width - margin - fontBold.widthOfTextAtSize(totalText, 18),
      y: y - 2,
      size: 18, font: fontBold, color: black,
    })
    y -= 36
  }

  // ── Customer message ───────────────────────────────────────────────────
  if (inquiry.message) {
    rule(y)
    y -= 20
    page.drawText('NOTE', { x: margin, y, size: 8, font: fontBold, color: muted })
    y -= 16

    // Wrap message text naively at ~80 chars
    const words  = inquiry.message.split(' ')
    let   line   = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (fontRegular.widthOfTextAtSize(test, 10) > col - 16) {
        page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: muted })
        y   -= 16
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: muted })
      y -= 16
    }
    y -= 8
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  const footerY = margin + 20
  rule(footerY + 12)

  const validityText = expiresAt
    ? `This quote is valid until ${new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}. Contact us to confirm your order.`
    : 'Please contact us to confirm your order.'

  page.drawText(validityText, { x: margin, y: footerY, size: 9, font: fontRegular, color: muted })

  const generatedText = 'Generated by Konfigurator'
  page.drawText(generatedText, {
    x: width - margin - fontRegular.widthOfTextAtSize(generatedText, 9),
    y: footerY,
    size: 9, font: fontRegular, color: faint,
  })

  return pdfDoc.save()
}

// ── Email template ─────────────────────────────────────────────────────────

function buildEmailHtml({
  tenantName,
  productName,
  inquiry,
  expiresAt,
  pdfUrl,
}: {
  tenantName:  string
  productName: string
  inquiry:     InquiryRow
  expiresAt:   string | null
  pdfUrl:      string
}): string {
  const config = Array.isArray(inquiry.configuration) ? inquiry.configuration : []

  const configRows = config.map(item => `
    <tr>
      <td style="padding:6px 12px;color:#555;font-size:14px;">${esc(item.characteristic_name)}</td>
      <td style="padding:6px 12px;font-size:14px;font-weight:600;">${esc(item.value_label)}</td>
      <td style="padding:6px 12px;font-size:14px;text-align:right;color:${item.price_modifier > 0 ? '#059669' : item.price_modifier < 0 ? '#dc2626' : '#555'};">
        ${item.price_modifier !== 0
          ? (item.price_modifier > 0 ? '+' : '') + item.price_modifier.toFixed(2)
          : '—'}
      </td>
    </tr>`).join('')

  const priceRow = inquiry.total_price != null ? `
    <tr style="border-top:2px solid #e5e7eb;">
      <td colspan="2" style="padding:10px 12px;font-weight:700;font-size:15px;">Total</td>
      <td style="padding:10px 12px;font-weight:700;font-size:15px;text-align:right;">
        ${inquiry.total_price.toFixed(2)} ${esc(inquiry.currency)}
      </td>
    </tr>` : ''

  const expiryBlock = expiresAt ? `
    <div style="margin-top:20px;padding:12px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        This quote is valid until <strong>${new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}</strong>.
        Please reply to this email to confirm your order.
      </p>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">

    <div style="padding:20px 28px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">${esc(tenantName)}</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111;">Your quote is ready</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Hi ${esc(inquiry.customer_name)}, please find your quote attached as a PDF.</p>
    </div>

    <div style="padding:24px 28px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Product</p>
      <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#111;">${esc(productName)}</p>

      ${config.length > 0 ? `
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Configuration</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;">Option</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;">Selected</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:500;">Modifier</th>
          </tr>
        </thead>
        <tbody>${configRows}</tbody>
        ${priceRow ? `<tfoot>${priceRow}</tfoot>` : ''}
      </table>` : ''}

      ${expiryBlock}

      <div style="margin-top:24px;text-align:center;">
        <a href="${esc(pdfUrl)}" style="display:inline-block;padding:10px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
          Download PDF Quote
        </a>
      </div>
    </div>

    <div style="padding:16px 28px;border-top:1px solid #e5e7eb;background:#f9fafb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Sent by ${esc(tenantName)} via Konfigurator &mdash;
        reply directly to this email if you have any questions.
      </p>
    </div>
  </div>
</body>
</html>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
