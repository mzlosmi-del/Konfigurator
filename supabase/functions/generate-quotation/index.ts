import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ConfigLineItem {
  characteristic_name: string
  value_label: string
  price_modifier: number
}

interface QuotationLineItem {
  product_id:   string
  product_name: string
  quantity:     number
  unit_price:   number
  configuration: ConfigLineItem[]
}

interface QuotationAdjustment {
  type:  'surcharge' | 'discount' | 'tax'
  label: string
  mode:  'percent' | 'fixed'
  value: number
}

interface QuotationRow {
  id:               string
  tenant_id:        string
  reference_number: string
  customer_name:    string
  customer_email:   string
  customer_company: string | null
  customer_phone:   string | null
  customer_address: string | null
  notes:            string | null
  valid_until:      string | null
  currency:         string
  subtotal:         number
  total_price:      number
  line_items:       QuotationLineItem[]
  adjustments:      QuotationAdjustment[]
  created_at:       string
}

interface TenantRow { name: string }

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  let quotation_id: string
  try {
    const body = await req.json()
    quotation_id = body.quotation_id
    if (!quotation_id) throw new Error('missing quotation_id')
  } catch {
    return new Response('Bad request', { status: 400, headers: corsHeaders })
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: qData, error: qErr } = await sb
      .from('quotations')
      .select('*')
      .eq('id', quotation_id)
      .single()

    if (qErr || !qData) {
      return new Response('Quotation not found', { status: 404, headers: corsHeaders })
    }
    const quotation = qData as QuotationRow

    const { data: tenantData } = await sb
      .from('tenants')
      .select('name')
      .eq('id', quotation.tenant_id)
      .single()
    const tenantName = (tenantData as TenantRow | null)?.name ?? 'Your store'

    const pdfBytes = await buildQuotationPdf({ tenantName, quotation })

    const filePath = `${quotation.tenant_id}/quotations/${quotation_id}.pdf`

    const { error: uploadErr } = await sb.storage
      .from('quotes')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('generate-quotation: storage upload failed', uploadErr)
      return new Response('Failed to store PDF', { status: 500, headers: corsHeaders })
    }

    const { data: { publicUrl } } = sb.storage.from('quotes').getPublicUrl(filePath)

    await sb.from('quotations').update({ pdf_url: publicUrl }).eq('id', quotation_id)

    return new Response(JSON.stringify({ pdf_url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('generate-quotation: unexpected error', err)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

// ── PDF Generation ─────────────────────────────────────────────────────────

async function buildQuotationPdf({
  tenantName,
  quotation,
}: {
  tenantName: string
  quotation:  QuotationRow
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([595, 842]) // A4

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 56
  const col    = width - margin * 2

  const black    = rgb(0.067, 0.067, 0.067)
  const muted    = rgb(0.45,  0.45,  0.45)
  const faint    = rgb(0.88,  0.88,  0.88)
  const accent   = rgb(0.145, 0.337, 0.922)
  const positive = rgb(0.055, 0.604, 0.408)
  const negative = rgb(0.847, 0.208, 0.208)

  let y = height - margin

  function rule(yPos: number, color = faint) {
    page.drawLine({
      start: { x: margin, y: yPos },
      end:   { x: width - margin, y: yPos },
      thickness: 0.5, color,
    })
  }

  // ── Header ─────────────────────────────────────────────────────────────
  page.drawText(tenantName.toUpperCase(), {
    x: margin, y, size: 9, font: fontBold, color: muted,
  })
  page.drawText('QUOTATION', {
    x: width - margin - fontBold.widthOfTextAtSize('QUOTATION', 22),
    y, size: 22, font: fontBold, color: black,
  })
  y -= 16

  page.drawText(`Ref: ${quotation.reference_number}`, {
    x: width - margin - fontRegular.widthOfTextAtSize(`Ref: ${quotation.reference_number}`, 9),
    y, size: 9, font: fontRegular, color: muted,
  })
  y -= 12

  const issueDate = new Date(quotation.created_at).toLocaleDateString('en-GB', { dateStyle: 'long' })
  page.drawText(`Issued: ${issueDate}`, { x: margin, y, size: 9, font: fontRegular, color: muted })

  if (quotation.valid_until) {
    const expDate = new Date(quotation.valid_until).toLocaleDateString('en-GB', { dateStyle: 'long' })
    const expText = `Valid until: ${expDate}`
    page.drawText(expText, {
      x: width - margin - fontRegular.widthOfTextAtSize(expText, 9),
      y, size: 9, font: fontRegular, color: muted,
    })
  }

  y -= 18
  rule(y)
  y -= 24

  // ── Prepared for ───────────────────────────────────────────────────────
  page.drawText('PREPARED FOR', { x: margin, y, size: 8, font: fontBold, color: muted })
  y -= 16
  page.drawText(quotation.customer_name, { x: margin, y, size: 13, font: fontBold, color: black })
  y -= 14
  page.drawText(quotation.customer_email, { x: margin, y, size: 10, font: fontRegular, color: accent })
  y -= 14

  if (quotation.customer_company) {
    page.drawText(quotation.customer_company, { x: margin, y, size: 10, font: fontRegular, color: muted })
    y -= 13
  }
  if (quotation.customer_phone) {
    page.drawText(quotation.customer_phone, { x: margin, y, size: 10, font: fontRegular, color: muted })
    y -= 13
  }
  if (quotation.customer_address) {
    page.drawText(quotation.customer_address, { x: margin, y, size: 10, font: fontRegular, color: muted })
    y -= 13
  }
  y -= 16

  rule(y)
  y -= 24

  // ── Line items table ───────────────────────────────────────────────────
  const items = Array.isArray(quotation.line_items) ? quotation.line_items : []

  if (items.length > 0) {
    page.drawText('LINE ITEMS', { x: margin, y, size: 8, font: fontBold, color: muted })
    y -= 16

    // Table header
    page.drawRectangle({ x: margin, y: y - 4, width: col, height: 22, color: rgb(0.96, 0.97, 0.98) })
    page.drawText('#',          { x: margin + 8,           y, size: 9, font: fontBold, color: muted })
    page.drawText('Product',    { x: margin + 28,          y, size: 9, font: fontBold, color: muted })
    page.drawText('Qty',        { x: margin + col * 0.60,  y, size: 9, font: fontBold, color: muted })
    page.drawText('Unit Price', { x: margin + col * 0.70,  y, size: 9, font: fontBold, color: muted })
    const totHeader = 'Total'
    page.drawText(totHeader, {
      x: margin + col - fontBold.widthOfTextAtSize(totHeader, 9) - 8,
      y, size: 9, font: fontBold, color: muted,
    })
    y -= 22

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const lineTotal = item.unit_price * item.quantity

      // Product name + configuration summary
      page.drawText(`${i + 1}`, { x: margin + 8, y, size: 10, font: fontRegular, color: muted })
      page.drawText(item.product_name, { x: margin + 28, y, size: 10, font: fontBold, color: black })
      y -= 13

      const cfg = Array.isArray(item.configuration) ? item.configuration : []
      for (const c of cfg) {
        const cfgText = `${c.characteristic_name}: ${c.value_label}`
        page.drawText(cfgText, { x: margin + 28, y, size: 8, font: fontRegular, color: muted })
        y -= 12
      }

      // Qty / unit / total — align to the last row rendered
      const rowY = y + 12 * (cfg.length > 0 ? cfg.length : 0) + (cfg.length > 0 ? 13 : 0)
      const unitText  = `${item.unit_price.toFixed(2)}`
      const totalText = `${lineTotal.toFixed(2)}`
      page.drawText(String(item.quantity), {
        x: margin + col * 0.60, y: rowY - (cfg.length > 0 ? 13 : 0),
        size: 10, font: fontRegular, color: black,
      })
      page.drawText(unitText, {
        x: margin + col * 0.70, y: rowY - (cfg.length > 0 ? 13 : 0),
        size: 10, font: fontRegular, color: black,
      })
      page.drawText(totalText, {
        x: margin + col - fontBold.widthOfTextAtSize(totalText, 10) - 8,
        y: rowY - (cfg.length > 0 ? 13 : 0),
        size: 10, font: fontBold, color: black,
      })

      y -= 10
      rule(y + 2, rgb(0.93, 0.93, 0.93))
    }
    y -= 10
  }

  // ── Subtotal + adjustments + total ─────────────────────────────────────
  rule(y)
  y -= 20

  const adjustments = Array.isArray(quotation.adjustments) ? quotation.adjustments : []

  // Subtotal
  const subtotalText = `${quotation.subtotal.toFixed(2)} ${quotation.currency}`
  page.drawText('Subtotal', { x: margin, y, size: 10, font: fontRegular, color: muted })
  page.drawText(subtotalText, {
    x: width - margin - fontRegular.widthOfTextAtSize(subtotalText, 10),
    y, size: 10, font: fontRegular, color: black,
  })
  y -= 18

  // Adjustments
  let running = quotation.subtotal
  for (const adj of adjustments) {
    const amount = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign   = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    if (adj.type !== 'discount') running += amount
    else running -= amount

    const adjLabel = `${adj.label} (${adj.type}${adj.mode === 'percent' ? `, ${adj.value}%` : ''})`
    const adjAmt   = `${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${quotation.currency}`
    const adjColor = applied >= 0 ? positive : negative

    page.drawText(adjLabel, { x: margin, y, size: 10, font: fontRegular, color: muted })
    page.drawText(adjAmt, {
      x: width - margin - fontBold.widthOfTextAtSize(adjAmt, 10),
      y, size: 10, font: fontBold, color: adjColor,
    })
    y -= 18
  }

  // Total
  rule(y)
  y -= 20
  page.drawText('TOTAL', { x: margin, y, size: 10, font: fontBold, color: muted })
  const totalText = `${quotation.total_price.toFixed(2)} ${quotation.currency}`
  page.drawText(totalText, {
    x: width - margin - fontBold.widthOfTextAtSize(totalText, 18),
    y: y - 2, size: 18, font: fontBold, color: black,
  })
  y -= 36

  // ── Notes ──────────────────────────────────────────────────────────────
  if (quotation.notes) {
    rule(y)
    y -= 20
    page.drawText('NOTES', { x: margin, y, size: 8, font: fontBold, color: muted })
    y -= 16
    const words = quotation.notes.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (fontRegular.widthOfTextAtSize(test, 10) > col - 16) {
        page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: muted })
        y -= 16
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: muted })
      y -= 16
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  const footerY = margin + 20
  rule(footerY + 12)

  const validityText = quotation.valid_until
    ? `This quotation is valid until ${new Date(quotation.valid_until).toLocaleDateString('en-GB', { dateStyle: 'long' })}. Contact us to confirm your order.`
    : 'Please contact us to confirm your order.'

  page.drawText(validityText, { x: margin, y: footerY, size: 9, font: fontRegular, color: muted })

  const generatedText = 'Generated by Konfigurator'
  page.drawText(generatedText, {
    x: width - margin - fontRegular.widthOfTextAtSize(generatedText, 9),
    y: footerY, size: 9, font: fontRegular, color: faint,
  })

  return pdfDoc.save()
}
