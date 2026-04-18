import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Quotation, QuotationLineItem, QuotationAdjustment } from '@/types/database'

export async function buildQuotationPdfBytes(
  tenantName: string,
  quotation: Quotation
): Promise<Uint8Array> {
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

  // ── Header ────────────────────────────────────────────────────────────────
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

  // ── Prepared for ──────────────────────────────────────────────────────────
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

  // ── Line items ────────────────────────────────────────────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    page.drawText('LINE ITEMS', { x: margin, y, size: 8, font: fontBold, color: muted })
    y -= 16

    page.drawRectangle({ x: margin, y: y - 4, width: col, height: 22, color: rgb(0.96, 0.97, 0.98) })
    page.drawText('#',          { x: margin + 8,          y, size: 9, font: fontBold, color: muted })
    page.drawText('Product',    { x: margin + 28,         y, size: 9, font: fontBold, color: muted })
    page.drawText('Qty',        { x: margin + col * 0.60, y, size: 9, font: fontBold, color: muted })
    page.drawText('Unit Price', { x: margin + col * 0.70, y, size: 9, font: fontBold, color: muted })
    const totHeader = 'Total'
    page.drawText(totHeader, {
      x: margin + col - fontBold.widthOfTextAtSize(totHeader, 9) - 8,
      y, size: 9, font: fontBold, color: muted,
    })
    y -= 22

    for (let i = 0; i < items.length; i++) {
      const item      = items[i]
      const lineTotal = item.unit_price * item.quantity

      page.drawText(`${i + 1}`, { x: margin + 8, y, size: 10, font: fontRegular, color: muted })
      page.drawText(item.product_name, { x: margin + 28, y, size: 10, font: fontBold, color: black })
      y -= 13

      const cfg = Array.isArray(item.configuration) ? item.configuration : []
      for (const c of cfg) {
        page.drawText(`${c.characteristic_name}: ${c.value_label}`, {
          x: margin + 28, y, size: 8, font: fontRegular, color: muted,
        })
        y -= 12
      }

      const rowY     = y + 12 * cfg.length + (cfg.length > 0 ? 13 : 0)
      const alignedY = rowY - (cfg.length > 0 ? 13 : 0)
      const unitText  = item.unit_price.toFixed(2)
      const totalText = lineTotal.toFixed(2)

      page.drawText(String(item.quantity), { x: margin + col * 0.60, y: alignedY, size: 10, font: fontRegular, color: black })
      page.drawText(unitText,  { x: margin + col * 0.70, y: alignedY, size: 10, font: fontRegular, color: black })
      page.drawText(totalText, {
        x: margin + col - fontBold.widthOfTextAtSize(totalText, 10) - 8,
        y: alignedY, size: 10, font: fontBold, color: black,
      })

      y -= 10
      rule(y + 2, rgb(0.93, 0.93, 0.93))
    }
    y -= 10
  }

  // ── Subtotal + adjustments + total ────────────────────────────────────────
  rule(y)
  y -= 20

  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]

  const subtotalText = `${quotation.subtotal.toFixed(2)} ${quotation.currency}`
  page.drawText('Subtotal', { x: margin, y, size: 10, font: fontRegular, color: muted })
  page.drawText(subtotalText, {
    x: width - margin - fontRegular.widthOfTextAtSize(subtotalText, 10),
    y, size: 10, font: fontRegular, color: black,
  })
  y -= 18

  let running = quotation.subtotal
  for (const adj of adjustments) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    if (adj.type !== 'discount') running += amount
    else running -= amount

    const adjLabel = `${adj.label} (${adj.type}${adj.mode === 'percent' ? `, ${adj.value}%` : ''})`
    const adjAmt   = `${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${quotation.currency}`

    page.drawText(adjLabel, { x: margin, y, size: 10, font: fontRegular, color: muted })
    page.drawText(adjAmt, {
      x: width - margin - fontBold.widthOfTextAtSize(adjAmt, 10),
      y, size: 10, font: fontBold, color: applied >= 0 ? positive : negative,
    })
    y -= 18
  }

  rule(y)
  y -= 20
  page.drawText('TOTAL', { x: margin, y, size: 10, font: fontBold, color: muted })
  const totalText = `${quotation.total_price.toFixed(2)} ${quotation.currency}`
  page.drawText(totalText, {
    x: width - margin - fontBold.widthOfTextAtSize(totalText, 18),
    y: y - 2, size: 18, font: fontBold, color: black,
  })
  y -= 36

  // ── Notes ─────────────────────────────────────────────────────────────────
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
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = margin + 20
  rule(footerY + 12)

  const validityText = quotation.valid_until
    ? `This quotation is valid until ${new Date(quotation.valid_until).toLocaleDateString('en-GB', { dateStyle: 'long' })}. Contact us to confirm your order.`
    : 'Please contact us to confirm your order.'

  page.drawText(validityText, { x: margin, y: footerY, size: 9, font: fontRegular, color: muted })
  page.drawText('Generated by Konfigurator', {
    x: width - margin - fontRegular.widthOfTextAtSize('Generated by Konfigurator', 9),
    y: footerY, size: 9, font: fontRegular, color: faint,
  })

  return pdfDoc.save()
}

export function openPdfBlob(bytes: Uint8Array) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
}
