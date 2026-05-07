import { PDFDocument, PDFPage, PDFFont, rgb, degrees } from 'pdf-lib'
import type { QuotationLineItem, QuotationAdjustment, ProductText } from '@/types/database'
import { calcLineTotal } from '@/lib/quotations'
import {
  C, wrapText, PDF_LABELS, loadFonts, loadLogo,
  isSectionVisible, buildOrderedSections,
  type PdfBuildArgs,
} from './shared'

/**
 * Compact — dense single-page-friendly. Tight margins, smaller type, inline
 * header bar, single-row meta strips. Use when the quote is short and the
 * customer wants one page if possible.
 */
export async function renderCompact(args: PdfBuildArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang, watermark } = args
  const L = PDF_LABELS[lang]
  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)

  const W = 595, H = 842
  const MX = 32, MB = 38
  const col = W - MX * 2

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    y = H - 22
    text(`${tenant.name} · ${L.quotation} ${quotation.reference_number}`, MX, y, 7.5, fontR, C.faint)
    y -= 8
    rule(y)
    y -= 14
  }

  function ensureSpace(needed: number) {
    if (y - needed < MB) newPage()
  }

  function text(str: string, x: number, yPos: number, size: number, font: PDFFont, color = C.ink) {
    str = str.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
    if (!str.trim()) return
    page.drawText(str, { x, y: yPos, size, font, color })
  }

  function rText(str: string, rightX: number, yPos: number, size: number, font: PDFFont, color = C.ink) {
    const w = font.widthOfTextAtSize(str, size)
    text(str, rightX - w, yPos, size, font, color)
  }

  function rule(yPos: number, color = C.rule, x1 = MX, x2 = W - MX) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.4, color })
  }

  function drawFooter() {
    const fy = MB - 12
    rule(fy + 10, C.rule)
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'short' }))
      : L.contactText
    text(validStr, MX, fy, 6.5, fontR, C.muted)
    rText(L.footer, W - MX, fy, 6.5, fontR, C.faint)
  }

  const logoImg = await loadLogo(pdfDoc, tenant.logo_url)

  // ── Inline header: logo · QUOTATION + reference (one row) ─────────────────
  const HDR_TOP = H - 28
  if (logoImg) {
    const dims = logoImg.scaleToFit(80, 28)
    page.drawImage(logoImg, {
      x: MX,
      y: HDR_TOP - dims.height + 6,
      width: dims.width, height: dims.height,
    })
  } else {
    text(tenant.name.toUpperCase(), MX, HDR_TOP, 11, fontB, C.ink)
  }
  rText(L.quotation, W - MX, HDR_TOP, 16, fontB, C.ink)
  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'medium' })
  let metaY = HDR_TOP - 16
  rText(`${quotation.reference_number}  ·  ${issueDate}`, W - MX, metaY, 8, fontR, C.muted)
  if (quotation.title) {
    metaY -= 11
    rText(quotation.title, W - MX, metaY, 8, fontR, C.faint)
  }

  y = HDR_TOP - 36
  rule(y)
  y -= 12

  // ── Single-row sender meta ───────────────────────────────────────────────
  const senderParts = [
    tenant.name,
    tenant.contact_person,
    tenant.company_address,
    tenant.company_phone,
    tenant.company_email,
    tenant.company_website,
    tenant.vat_number         ? `${L.vatNumber} ${tenant.vat_number}`         : null,
    tenant.company_reg_number ? `${L.regNumber} ${tenant.company_reg_number}` : null,
  ].filter(Boolean) as string[]
  if (senderParts.length) {
    for (const line of wrapText(senderParts.join('  ·  '), fontR, 7.5, col)) {
      text(line, MX, y, 7.5, fontR, C.muted)
      y -= 10
    }
  }
  y -= 6
  rule(y)
  y -= 12

  // ── Bill-to + dates as a two-line block ──────────────────────────────────
  text(L.billTo, MX, y, 7, fontB, C.muted)
  text(L.quoteDetails, MX + col / 2 + 8, y, 7, fontB, C.muted)
  y -= 11
  // Customer left
  text(quotation.customer_name, MX, y, 10, fontB, C.ink)
  // Details right (two columns within right half)
  const detailRX = MX + col / 2 + 8
  const dW = (col / 2 - 8) / 2
  text(L.issued, detailRX, y, 7, fontR, C.muted)
  text(issueDate, detailRX + dW, y, 8, fontB, C.ink)
  y -= 12
  if (quotation.customer_company) {
    text(quotation.customer_company, MX, y, 8, fontR, C.muted)
  }
  if (quotation.valid_until) {
    text(L.validUntil, detailRX, y, 7, fontR, C.muted)
    text(
      new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'medium' }),
      detailRX + dW, y, 8, fontB, C.ink,
    )
  }
  y -= 12
  if (quotation.customer_email) {
    text(quotation.customer_email, MX, y, 8, fontR, C.accent)
  }
  text(L.currency, detailRX, y, 7, fontR, C.muted)
  text(quotation.currency, detailRX + dW, y, 8, fontB, C.ink)
  y -= 12
  if (quotation.customer_phone) {
    text(quotation.customer_phone, MX, y, 8, fontR, C.muted)
  }
  if (quotation.payment_terms) {
    text(L.paymentTerms, detailRX, y, 7, fontR, C.muted)
    const ptLines = wrapText(quotation.payment_terms, fontR, 7.5, dW + (col / 2 - 8) / 2 - dW)
    text(ptLines[0] ?? '', detailRX + dW, y, 8, fontB, C.ink)
  }
  y -= 12
  if (quotation.customer_address) {
    for (const line of wrapText(quotation.customer_address, fontR, 7.5, col / 2 - 4)) {
      text(line, MX, y, 7.5, fontR, C.faint); y -= 10
    }
  }
  if (quotation.customer_vat_number) {
    text(`${L.customerVat}: ${quotation.customer_vat_number}`, MX, y, 7, fontR, C.faint)
    y -= 10
  }
  if (quotation.delivery_address) {
    text(L.shipTo, MX, y, 6.5, fontB, C.muted)
    y -= 9
    for (const line of wrapText(quotation.delivery_address, fontR, 7.5, col / 2 - 4)) {
      text(line, MX, y, 7.5, fontR, C.faint); y -= 10
    }
  }

  y -= 6
  rule(y)
  y -= 12

  // ── Line items: tighter rows, 4 columns instead of 6 ─────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    text(L.lineItems, MX, y, 7, fontB, C.muted)
    y -= 4
    rule(y)
    y -= 11

    const C_PROD = MX
    const C_QTY  = MX + col * 0.62
    const C_UPR  = MX + col * 0.80
    const C_TR   = MX + col
    const PROD_W = C_QTY - C_PROD - 6

    text(L.product,    C_PROD, y, 6.5, fontB, C.muted)
    rText(L.qty,       C_QTY + 14, y, 6.5, fontB, C.muted)
    rText(L.unitPrice, C_UPR, y, 6.5, fontB, C.muted)
    rText(L.total,     C_TR,  y, 6.5, fontB, C.muted)
    y -= 4
    rule(y)
    y -= 10

    for (let i = 0; i < items.length; i++) {
      const item        = items[i]
      const baseLine    = item.unit_price * item.quantity
      const itemAdjs    = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal   = calcLineTotal(item)
      const cfg         = Array.isArray(item.configuration) ? item.configuration : []
      const formulas    = Array.isArray(item.formulas) ? item.formulas : []
      const ptexts      = (productTexts?.[item.product_id] ?? []).filter(pt => pt.language === lang)

      // Compact mode summarises the breakdown: we show config as a single
      // wrapped line of "char: val · char: val" rather than one row each.
      const cfgSummary = cfg.map(c => {
        const mod = Number(c.price_modifier) || 0
        return `${c.value_label}${mod ? ` (${mod >= 0 ? '+' : ''}${mod.toFixed(0)})` : ''}`
      }).join(' · ')
      const formulaSummary = formulas.map(f => {
        const amt = Number(f.amount) || 0
        return `ƒ ${f.formula_name}${amt ? ` (${amt >= 0 ? '+' : ''}${amt.toFixed(0)})` : ''}`
      }).join(' · ')
      const summary = [cfgSummary, formulaSummary].filter(Boolean).join(' · ')

      const nameLines = wrapText(item.product_name, fontB, 9, PROD_W)
      const sumLines  = summary ? wrapText(summary, fontR, 7, PROD_W - 6) : []
      let rh = nameLines.length * 11
      if (item.product_sku) rh += 9
      rh += sumLines.length * 9
      for (const pt of ptexts) rh += 9 + wrapText(pt.content, fontR, 7, PROD_W - 6).length * 9
      if (itemAdjs.length > 0) rh += itemAdjs.length * 9 + 4
      rh += 8
      ensureSpace(rh)

      const rowY = y

      for (const line of nameLines) {
        text(line, C_PROD, y, 9, fontB, C.ink)
        y -= 11
      }
      if (item.product_sku) {
        text(`SKU: ${item.product_sku}`, C_PROD, y, 7, fontR, C.faint)
        y -= 9
      }
      for (const line of sumLines) {
        text(line, C_PROD + 6, y, 7, fontR, C.muted)
        y -= 9
      }
      for (const pt of ptexts) {
        const ptLines = wrapText(pt.content, fontR, 7, PROD_W - 6)
        text(`${pt.label}:`, C_PROD + 6, y, 6.5, fontB, C.muted)
        y -= 9
        for (const line of ptLines) {
          text(line, C_PROD + 12, y, 7, fontR, C.muted)
          y -= 9
        }
      }
      if (itemAdjs.length > 0) {
        y -= 2
        let runItem = baseLine
        for (const adj of itemAdjs) {
          const amt     = adj.mode === 'percent' ? (runItem * adj.value) / 100 : adj.value
          const applied = adj.type === 'discount' ? -amt : amt
          runItem += applied
          const lbl = `${adj.label || adj.type}${adj.mode === 'percent' ? ` (${adj.value}%)` : ''}`
          text(lbl, C_PROD + 6, y, 7, fontR, C.muted)
          rText(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)}`, C_TR, y, 7, fontR,
            applied >= 0 ? C.positive : C.negative)
          y -= 9
        }
      }

      rText(String(item.quantity),       C_QTY + 14, rowY, 9, fontR, C.ink)
      rText(item.unit_price.toFixed(2),  C_UPR, rowY, 9, fontR, C.ink)
      rText(`${lineTotal.toFixed(2)}`,   C_TR,  rowY, 9.5, fontB, C.ink)

      y -= 4
      if (i < items.length - 1)
        page.drawLine({ start: { x: MX, y: y + 2 }, end: { x: MX + col, y: y + 2 }, thickness: 0.2, color: C.rule })
    }
    y -= 6
  }

  // ── Inline financial summary (right-aligned, no panel) ───────────────────
  rule(y)
  y -= 12

  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const SUM_W = 200
  const SUM_L = W - MX - SUM_W
  const SUM_R = W - MX

  text(L.subtotal, SUM_L, y, 8.5, fontR, C.muted)
  rText(`${quotation.subtotal.toFixed(2)} ${quotation.currency}`, SUM_R, y, 8.5, fontR, C.ink)
  y -= 13

  let running = quotation.subtotal
  for (const adj of adjustments) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    if (adj.type !== 'discount') running += amount
    else running -= amount

    const pct    = adj.mode === 'percent' ? ` ${adj.value}%` : ''
    const label  = `${adj.label}${pct}`
    text(label, SUM_L, y, 8, fontR, C.muted)
    rText(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${quotation.currency}`,
      SUM_R, y, 8, fontB, applied >= 0 ? C.positive : C.negative)
    y -= 12
  }

  ensureSpace(22)
  rule(y, C.ink)
  y -= 14
  text(L.totalDue, SUM_L, y, 8, fontB, C.muted)
  rText(`${quotation.total_price.toFixed(2)} ${quotation.currency}`, SUM_R, y, 13, fontB, C.ink)
  y -= 18

  // ── Notes / terms / global texts (no boxes, just labels + lines) ────────
  function drawNotesSection() {
    if (!quotation.notes) return
    const lines = wrapText(quotation.notes, fontR, 8, col)
    ensureSpace(20 + lines.length * 11)
    y -= 8
    rule(y)
    y -= 12
    text(L.notes, MX, y, 6.5, fontB, C.muted)
    y -= 10
    for (const line of lines) {
      ensureSpace(11)
      text(line, MX, y, 8, fontR, C.ink)
      y -= 11
    }
  }

  function drawTermsSection() {
    const boxLines = L.termsLines
    ensureSpace(20 + boxLines.length * 9)
    y -= 8
    rule(y)
    y -= 12
    text(L.termsHeader, MX, y, 6.5, fontB, C.muted)
    y -= 10
    for (const line of boxLines) {
      ensureSpace(9)
      text(line, MX, y, 7, fontR, C.muted)
      y -= 9
    }
  }

  function drawGlobalTextSection(txt: ProductText) {
    const lines = wrapText(txt.content, fontR, 8, col)
    ensureSpace(20 + lines.length * 11)
    y -= 8
    rule(y)
    y -= 12
    text(txt.label.toUpperCase(), MX, y, 6.5, fontB, C.muted)
    y -= 10
    for (const line of lines) {
      ensureSpace(11)
      text(line, MX, y, 8, fontR, C.ink)
      y -= 11
    }
  }

  const orderedSections = buildOrderedSections(layoutSections, globalTexts, lang)

  for (const section of orderedSections) {
    if (!section.visible) continue
    if (section.id === 'notes') {
      if (isSectionVisible(layoutSections, 'notes')) drawNotesSection()
    } else if (section.id === 'terms') {
      if (isSectionVisible(layoutSections, 'terms')) drawTermsSection()
    } else if (section.textId) {
      const gt = (globalTexts ?? []).find(t => t.id === section.textId && t.language === lang)
      if (gt) drawGlobalTextSection(gt)
    }
  }

  drawFooter()

  const pages = pdfDoc.getPages()
  const N     = pages.length
  for (let i = 0; i < N; i++) {
    const pg    = pages[i]
    const label = `${L.page} ${i + 1} ${L.of} ${N}`
    const lw    = fontR.widthOfTextAtSize(label, 6.5)
    pg.drawText(label, { x: W / 2 - lw / 2, y: MB - 12, size: 6.5, font: fontR, color: C.faint })
  }

  if (watermark) {
    const wmText  = L.previewWatermark
    const wmSize  = 36
    const wmColor = rgb(0.86, 0.86, 0.88)
    const tw      = fontB.widthOfTextAtSize(wmText, wmSize)
    const angle   = Math.PI / 4
    const cx = W / 2, cy = H / 2
    const startX = cx - (tw / 2) * Math.cos(angle) - (wmSize / 2) * Math.sin(angle)
    const startY = cy - (tw / 2) * Math.sin(angle) + (wmSize / 2) * Math.cos(angle) - wmSize
    for (const pg of pages) {
      pg.drawText(wmText, {
        x: startX, y: startY, size: wmSize, font: fontB, color: wmColor,
        rotate: degrees(45),
      })
    }
  }

  return pdfDoc.save()
}
