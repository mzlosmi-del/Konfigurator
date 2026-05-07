import { PDFDocument, PDFPage, PDFFont, rgb, degrees } from 'pdf-lib'
import type { QuotationLineItem, QuotationAdjustment, ProductText } from '@/types/database'
import { calcLineTotal } from '@/lib/quotations'
import {
  C, wrapText, PDF_LABELS, loadFonts, loadLogo,
  isSectionVisible, buildOrderedSections,
  type PdfBuildArgs,
} from './shared'

/**
 * Classic — traditional corporate invoice. Dark navy header band, boxed
 * sender/customer panels, filled table header, filled total panel. Heavier
 * visual structure than Modern.
 */
export async function renderClassic(args: PdfBuildArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang, watermark } = args
  const L = PDF_LABELS[lang]
  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)

  // Classic palette: navy primary + warm gray surfaces.
  const NAVY      = rgb(0.165, 0.196, 0.251)   // #2A3240
  const NAVY_DARK = rgb(0.110, 0.137, 0.184)   // #1C232F
  const PANEL_BG  = rgb(0.973, 0.973, 0.969)   // #F8F8F7
  const BORDER    = rgb(0.737, 0.749, 0.769)   // #BCBFC4

  const W = 595, H = 842
  const MX = 42, MB = 56
  const col = W - MX * 2

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    // Slim continuation header
    page.drawRectangle({ x: 0, y: H - 22, width: W, height: 22, color: NAVY })
    text(tenant.name.toUpperCase(), MX, H - 15, 8, fontB, C.white)
    rText(`${L.quotation} · ${quotation.reference_number}`, W - MX, H - 15, 8, fontR, C.white)
    y = H - 22 - 24
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

  function rule(yPos: number, color = BORDER, x1 = MX, x2 = W - MX) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.6, color })
  }

  function drawFooter() {
    const fy = MB - 18
    page.drawRectangle({ x: 0, y: 0, width: W, height: 24, color: NAVY })
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }))
      : L.contactText
    text(validStr, MX, fy, 7.5, fontR, C.white)
    rText(L.footer, W - MX, fy, 7.5, fontR, C.white)
  }

  const logoImg = await loadLogo(pdfDoc, tenant.logo_url)

  // ── Header band ───────────────────────────────────────────────────────────
  const HDR_H = 92
  page.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: HDR_H, color: NAVY })

  if (logoImg) {
    // Logo gets a small white card on the navy band
    const dims = logoImg.scaleToFit(120, 50)
    const cardX = MX, cardY = H - HDR_H + (HDR_H - dims.height) / 2
    page.drawRectangle({
      x: cardX - 6, y: cardY - 6, width: dims.width + 12, height: dims.height + 12,
      color: C.white,
    })
    page.drawImage(logoImg, { x: cardX, y: cardY, width: dims.width, height: dims.height })
  } else {
    text(tenant.name.toUpperCase(), MX, H - 38, 16, fontB, C.white)
    text(L.preparedBy.toUpperCase(), MX, H - 56, 7, fontR, rgb(0.78, 0.82, 0.88))
  }

  rText(L.quotation, W - MX, H - 38, 24, fontB, C.white)
  rText(quotation.reference_number, W - MX, H - 60, 9.5, fontR, rgb(0.78, 0.82, 0.88))
  if (quotation.title) {
    rText(quotation.title, W - MX, H - 74, 8.5, fontR, rgb(0.78, 0.82, 0.88))
  }

  y = H - HDR_H - 18

  // ── Sender & customer panels (two boxes) ──────────────────────────────────
  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })
  const half = (col - 14) / 2
  const LX = MX, RX = MX + half + 14
  const PANEL_PAD = 12
  const PANEL_TOP_LBL_H = 22

  // Pre-compute heights so the two panels stay equal.
  function senderLineCount(): number {
    let n = 1   // company name
    const senderParts = [
      tenant.contact_person, tenant.company_address, tenant.company_phone,
      tenant.company_email,  tenant.company_website,
    ].filter(Boolean) as string[]
    if (senderParts.length) n += senderParts.length
    if (tenant.vat_number)         n++
    if (tenant.company_reg_number) n++
    return n
  }
  function billLineCount(): number {
    let n = 1   // customer name
    if (quotation.customer_company) n++
    if (quotation.customer_email)   n++
    if (quotation.customer_phone)   n++
    if (quotation.customer_address) n += wrapText(quotation.customer_address, fontR, 9, half - PANEL_PAD * 2).length
    if (quotation.customer_vat_number) n++
    return n
  }
  const PANEL_LINE_H = 13
  const panelH = Math.max(senderLineCount(), billLineCount()) * PANEL_LINE_H + PANEL_TOP_LBL_H + PANEL_PAD

  // Left panel: sender
  page.drawRectangle({
    x: LX, y: y - panelH, width: half, height: panelH,
    color: PANEL_BG, borderColor: BORDER, borderWidth: 0.5,
  })
  let lpy = y - 14
  text(L.preparedBy.toUpperCase(), LX + PANEL_PAD, lpy, 7.5, fontB, NAVY)
  lpy -= PANEL_TOP_LBL_H - 14
  rule(lpy + 4, BORDER, LX + PANEL_PAD, LX + half - PANEL_PAD)
  lpy -= PANEL_LINE_H
  text(tenant.name, LX + PANEL_PAD, lpy, 10, fontB, C.ink)
  lpy -= PANEL_LINE_H
  if (tenant.contact_person) { text(tenant.contact_person, LX + PANEL_PAD, lpy, 9, fontR, C.muted); lpy -= PANEL_LINE_H }
  if (tenant.company_address) { text(tenant.company_address, LX + PANEL_PAD, lpy, 9, fontR, C.muted); lpy -= PANEL_LINE_H }
  if (tenant.company_phone)   { text(tenant.company_phone,   LX + PANEL_PAD, lpy, 9, fontR, C.muted); lpy -= PANEL_LINE_H }
  if (tenant.company_email)   { text(tenant.company_email,   LX + PANEL_PAD, lpy, 9, fontR, C.accent); lpy -= PANEL_LINE_H }
  if (tenant.company_website) { text(tenant.company_website, LX + PANEL_PAD, lpy, 9, fontR, C.muted); lpy -= PANEL_LINE_H }
  if (tenant.vat_number)         { text(`${L.vatNumber} ${tenant.vat_number}`,         LX + PANEL_PAD, lpy, 8, fontR, C.faint); lpy -= PANEL_LINE_H }
  if (tenant.company_reg_number) { text(`${L.regNumber} ${tenant.company_reg_number}`, LX + PANEL_PAD, lpy, 8, fontR, C.faint); lpy -= PANEL_LINE_H }

  // Right panel: bill-to
  page.drawRectangle({
    x: RX, y: y - panelH, width: half, height: panelH,
    color: PANEL_BG, borderColor: BORDER, borderWidth: 0.5,
  })
  let rpy = y - 14
  text(L.billTo, RX + PANEL_PAD, rpy, 7.5, fontB, NAVY)
  rpy -= PANEL_TOP_LBL_H - 14
  rule(rpy + 4, BORDER, RX + PANEL_PAD, RX + half - PANEL_PAD)
  rpy -= PANEL_LINE_H
  text(quotation.customer_name, RX + PANEL_PAD, rpy, 10, fontB, C.ink)
  rpy -= PANEL_LINE_H
  if (quotation.customer_company) { text(quotation.customer_company, RX + PANEL_PAD, rpy, 9, fontR, C.muted); rpy -= PANEL_LINE_H }
  if (quotation.customer_email)   { text(quotation.customer_email,   RX + PANEL_PAD, rpy, 9, fontR, C.accent); rpy -= PANEL_LINE_H }
  if (quotation.customer_phone)   { text(quotation.customer_phone,   RX + PANEL_PAD, rpy, 9, fontR, C.muted); rpy -= PANEL_LINE_H }
  if (quotation.customer_address) {
    for (const line of wrapText(quotation.customer_address, fontR, 9, half - PANEL_PAD * 2)) {
      text(line, RX + PANEL_PAD, rpy, 9, fontR, C.muted); rpy -= PANEL_LINE_H
    }
  }
  if (quotation.customer_vat_number) {
    text(`${L.customerVat}: ${quotation.customer_vat_number}`, RX + PANEL_PAD, rpy, 8, fontR, C.faint)
    rpy -= PANEL_LINE_H
  }

  y -= panelH + 14

  // ── Quote details strip (dates, currency, terms) ──────────────────────────
  const strip = [
    [L.issued, issueDate],
    quotation.valid_until
      ? [L.validUntil, new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })]
      : null,
    [L.currency, quotation.currency],
    quotation.payment_terms ? [L.paymentTerms, quotation.payment_terms] : null,
  ].filter((x): x is [string, string] => Array.isArray(x))

  const STRIP_H = 36
  page.drawRectangle({
    x: MX, y: y - STRIP_H, width: col, height: STRIP_H,
    color: NAVY_DARK,
  })
  const cellW = col / strip.length
  for (let i = 0; i < strip.length; i++) {
    const cx = MX + cellW * i + 12
    text(strip[i][0].toUpperCase(), cx, y - 13, 6.5, fontB, rgb(0.66, 0.71, 0.78))
    text(strip[i][1],               cx, y - 26, 9,   fontB, C.white)
    if (i > 0) {
      page.drawLine({
        start: { x: MX + cellW * i, y: y - 6 },
        end:   { x: MX + cellW * i, y: y - STRIP_H + 6 },
        thickness: 0.5, color: rgb(0.42, 0.46, 0.52),
      })
    }
  }
  y -= STRIP_H + 18

  // ── Ship to ───────────────────────────────────────────────────────────────
  if (quotation.delivery_address) {
    text(L.shipTo, MX, y, 8, fontB, NAVY)
    y -= 12
    for (const line of wrapText(quotation.delivery_address, fontR, 9, col)) {
      text(line, MX, y, 9, fontR, C.muted); y -= 12
    }
    y -= 8
  }

  // ── Line items ────────────────────────────────────────────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    ensureSpace(60)

    const C_NUM  = MX + 6
    const C_PROD = MX + 22
    const C_QTY  = MX + col * 0.56
    const C_UOM  = MX + col * 0.64
    const C_UPR  = MX + col * 0.84
    const C_TR   = MX + col - 6
    const PROD_W = C_QTY - C_PROD - 6

    // Filled table header bar
    const HDR_H_ROW = 22
    page.drawRectangle({ x: MX, y: y - HDR_H_ROW, width: col, height: HDR_H_ROW, color: NAVY })
    const hbY = y - 14
    text('#',          C_NUM,  hbY, 8, fontB, C.white)
    text(L.product,    C_PROD, hbY, 8, fontB, C.white)
    text(L.qty,        C_QTY,  hbY, 8, fontB, C.white)
    text(L.uom,        C_UOM,  hbY, 8, fontB, C.white)
    rText(L.unitPrice, C_UPR,  hbY, 8, fontB, C.white)
    rText(L.total,     C_TR,   hbY, 8, fontB, C.white)
    y -= HDR_H_ROW + 4

    for (let i = 0; i < items.length; i++) {
      const item         = items[i]
      const baseLine     = item.unit_price * item.quantity
      const itemAdjs     = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal    = calcLineTotal(item)
      const cfg          = Array.isArray(item.configuration) ? item.configuration : []
      const formulas     = Array.isArray(item.formulas) ? item.formulas : []
      const ptexts       = (productTexts?.[item.product_id] ?? []).filter(pt => pt.language === lang)
      const modifierSum  = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
      const formulaSum   = formulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
      const derivedBase  = item.unit_price - modifierSum - formulaSum
      const showBreakdown = cfg.length > 0 || formulas.length > 0

      const nameLines = wrapText(item.product_name, fontB, 10, PROD_W)
      let rh = nameLines.length * 13
      if (item.product_sku)    rh += 11
      if (showBreakdown)       rh += 11 + (cfg.length + formulas.length) * 11
      for (const pt of ptexts) rh += 11 + wrapText(pt.content, fontR, 8, PROD_W - 4).length * 11
      if (itemAdjs.length > 0) rh += 4 + 11 + itemAdjs.length * 11
      rh += 14
      ensureSpace(rh)

      // Striped rows
      if (i % 2 === 1)
        page.drawRectangle({ x: MX, y: y - rh + 4, width: col, height: rh, color: PANEL_BG })

      const rowY = y

      text(`${i + 1}`, C_NUM, y, 9, fontR, C.muted)

      for (const line of nameLines) {
        text(line, C_PROD, y, 10, fontB, NAVY)
        y -= 13
      }

      if (item.product_sku) {
        text(`SKU: ${item.product_sku}`, C_PROD, y, 7.5, fontR, C.muted)
        y -= 11
      }

      if (showBreakdown) {
        text(L.basePrice, C_PROD + 4, y, 8, fontR, C.muted)
        rText(derivedBase.toFixed(2), C_TR, y, 8, fontR, C.muted)
        y -= 11
        for (const c of cfg) {
          text(`+ ${c.characteristic_name}: ${c.value_label}`, C_PROD + 4, y, 8, fontR, C.muted)
          const mod      = Number(c.price_modifier) || 0
          const modStr   = mod === 0 ? '—' : `${mod >= 0 ? '+' : ''}${mod.toFixed(2)}`
          const modColor = mod > 0 ? C.positive : mod < 0 ? C.negative : C.muted
          rText(modStr, C_TR, y, 8, fontR, modColor)
          y -= 11
        }
        for (const f of formulas) {
          text(`ƒ ${f.formula_name}`, C_PROD + 4, y, 8, fontR, C.muted)
          const amt      = Number(f.amount) || 0
          const amtStr   = amt === 0 ? '—' : `${amt >= 0 ? '+' : ''}${amt.toFixed(2)}`
          const amtColor = amt > 0 ? C.positive : amt < 0 ? C.negative : C.muted
          rText(amtStr, C_TR, y, 8, fontR, amtColor)
          y -= 11
        }
      }

      for (const pt of ptexts) {
        text(`${pt.label}:`, C_PROD + 4, y, 7.5, fontB, NAVY)
        y -= 11
        for (const line of wrapText(pt.content, fontR, 8, PROD_W - 4)) {
          text(line, C_PROD + 8, y, 8, fontR, C.muted)
          y -= 11
        }
      }

      if (itemAdjs.length > 0) {
        y -= 4
        text(L.subtotal, C_PROD + 4, y, 8, fontR, C.muted)
        rText(baseLine.toFixed(2), C_TR, y, 8, fontR, C.muted)
        y -= 11
        let runItem = baseLine
        for (const adj of itemAdjs) {
          const amt     = adj.mode === 'percent' ? (runItem * adj.value) / 100 : adj.value
          const applied = adj.type === 'discount' ? -amt : amt
          runItem += applied
          const lbl = `${adj.label || adj.type}${adj.mode === 'percent' ? ` (${adj.value}%)` : ''}`
          text(lbl, C_PROD + 4, y, 8, fontR, C.muted)
          rText(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)}`, C_TR, y, 8, fontR,
            applied >= 0 ? C.positive : C.negative)
          y -= 11
        }
      }

      text(String(item.quantity),       C_QTY, rowY, 9.5, fontR, C.ink)
      text(item.unit_of_measure ?? '—', C_UOM, rowY, 9.5, fontR, C.muted)
      rText(item.unit_price.toFixed(2), C_UPR, rowY, 9.5, fontR, C.ink)
      rText(lineTotal.toFixed(2),       C_TR,  rowY, 10,  fontB, NAVY)

      y -= 8
      page.drawLine({ start: { x: MX, y: y + 4 }, end: { x: MX + col, y: y + 4 }, thickness: 0.4, color: BORDER })
    }
    y -= 12
  }

  // ── Financial summary: panel on right ────────────────────────────────────
  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const SUM_W = 260
  const SUM_L = W - MX - SUM_W
  const SUM_R = W - MX
  const SUM_PAD = 12

  const sumRowCount = 1 + adjustments.length   // subtotal + adjustments
  const sumPanelH   = sumRowCount * 16 + 50    // rows + total row
  ensureSpace(sumPanelH + 12)

  // Panel: light box with adjustments, dark band with total
  page.drawRectangle({
    x: SUM_L, y: y - sumPanelH, width: SUM_W, height: sumPanelH,
    color: PANEL_BG, borderColor: BORDER, borderWidth: 0.5,
  })

  let sy = y - 16
  text(L.subtotal, SUM_L + SUM_PAD, sy, 9, fontR, C.muted)
  rText(`${quotation.subtotal.toFixed(2)} ${quotation.currency}`, SUM_R - SUM_PAD, sy, 9, fontR, C.ink)
  sy -= 16

  let running = quotation.subtotal
  for (const adj of adjustments) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    if (adj.type !== 'discount') running += amount
    else running -= amount

    const pct    = adj.mode === 'percent' ? ` ${adj.value}%` : ''
    const label  = `${adj.label}${pct}`
    const amtStr = `${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${quotation.currency}`
    text(label, SUM_L + SUM_PAD, sy, 9, fontR, C.muted)
    rText(amtStr, SUM_R - SUM_PAD, sy, 9, fontB, applied >= 0 ? C.positive : C.negative)
    sy -= 16
  }

  // Total band
  const TOT_H = 36
  page.drawRectangle({
    x: SUM_L, y: y - sumPanelH, width: SUM_W, height: TOT_H,
    color: NAVY,
  })
  text(L.totalDue, SUM_L + SUM_PAD, y - sumPanelH + 14, 9, fontB, rgb(0.78, 0.82, 0.88))
  rText(
    `${quotation.total_price.toFixed(2)} ${quotation.currency}`,
    SUM_R - SUM_PAD, y - sumPanelH + 12, 14, fontB, C.white,
  )

  y -= sumPanelH + 22

  // ── Notes / terms / global texts ─────────────────────────────────────────
  function drawBorderedBlock(label: string, lines: string[], padded = false) {
    const innerW = col - 24
    const wrapped = lines.flatMap(line => wrapText(line, fontR, 9, innerW))
    const BOX_H   = wrapped.length * 13 + 30
    ensureSpace(BOX_H + 16)
    y -= 8
    page.drawRectangle({
      x: MX, y: y - BOX_H, width: col, height: BOX_H,
      color: padded ? PANEL_BG : C.white, borderColor: BORDER, borderWidth: 0.5,
    })
    text(label.toUpperCase(), MX + 12, y - 14, 7.5, fontB, NAVY)
    rule(y - 18, BORDER, MX + 12, MX + col - 12)
    let by = y - 30
    for (const line of wrapped) {
      text(line, MX + 12, by, 9, fontR, C.ink)
      by -= 13
    }
    y -= BOX_H + 6
  }

  function drawNotesSection() {
    if (!quotation.notes) return
    drawBorderedBlock(L.notes, quotation.notes.split(/\r?\n/))
  }

  function drawTermsSection() {
    drawBorderedBlock(L.termsHeader, L.termsLines, true)
  }

  function drawGlobalTextSection(txt: ProductText) {
    drawBorderedBlock(txt.label, txt.content.split(/\r?\n/))
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
    const lw    = fontR.widthOfTextAtSize(label, 7.5)
    pg.drawText(label, { x: W / 2 - lw / 2, y: MB - 18, size: 7.5, font: fontR, color: C.white })
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
