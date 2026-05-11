import { PDFDocument, PDFPage, PDFFont, rgb, degrees } from 'pdf-lib'
import type { QuotationLineItem, QuotationAdjustment, ProductText } from '@/types/database'
import { calcLineTotal } from '@/lib/quotations'
import {
  C, wrapText, PDF_LABELS, loadFonts, loadLogo, getFooterLabel,
  isSectionVisible, buildOrderedSections,
  type PdfBuildArgs,
} from './shared'

/**
 * Classic — traditional professional invoice. Modeled on common online
 * quotation templates (FreshBooks / QuickBooks / Wave): clean white surface
 * with a single accent rule, navy table header, and a navy total bar. Every
 * section is single-column and flows top-down — no overlapping panels.
 */
export async function renderClassic(args: PdfBuildArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang, watermark } = args
  const L = PDF_LABELS[lang]
  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)

  const NAVY     = rgb(0.165, 0.196, 0.251)   // #2A3240
  const PANEL_BG = rgb(0.969, 0.973, 0.980)   // #F7F8FA
  const BORDER   = rgb(0.804, 0.812, 0.831)   // #CDCFD4

  const W = 595, H = 842
  const MX = 44
  // Footer position is now absolute (from page bottom) instead of derived
  // from MB. MB stays as the safe content threshold and is set well above
  // the footer rule so long lists never overlap the footer or the
  // validity / branding line.
  const FOOTER_BASELINE = 28
  const FOOTER_RULE_Y   = FOOTER_BASELINE + 12
  const MB              = FOOTER_RULE_Y + 24
  const col = W - MX * 2

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    y = H - 32
    text(tenant.name.toUpperCase(), MX, y, 8, fontB, NAVY)
    rText(`${L.quotation} · ${quotation.reference_number}`, W - MX, y, 8, fontR, C.muted)
    y -= 8
    rule(y, NAVY, MX, W - MX, 1.2)
    y -= 22
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

  function rule(yPos: number, color = BORDER, x1 = MX, x2 = W - MX, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color })
  }

  function sectionHeading(label: string) {
    ensureSpace(20)
    text(label, MX, y, 8, fontB, NAVY)
    y -= 6
    rule(y, NAVY, MX, MX + 36, 1)
    y -= 14
  }

  function drawFooter() {
    rule(FOOTER_RULE_Y, BORDER, MX, W - MX, 0.5)
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }))
      : L.contactText
    text(validStr, MX, FOOTER_BASELINE, 7.5, fontR, C.muted)
    rText(getFooterLabel(tenant, L.footer), W - MX, FOOTER_BASELINE, 7.5, fontR, C.faint)
  }

  const logoImg = await loadLogo(pdfDoc, tenant.logo_url)

  // ── Header: logo (left) + title block (right). No band — clean white. ─────
  const HDR_TOP = H - 44
  const LOGO_W  = 150, LOGO_H = 50

  if (logoImg) {
    const dims = logoImg.scaleToFit(LOGO_W, LOGO_H)
    page.drawImage(logoImg, {
      x: MX, y: HDR_TOP - dims.height + 2,
      width: dims.width, height: dims.height,
    })
  } else {
    text(tenant.name.toUpperCase(), MX, HDR_TOP - 4, 14, fontB, NAVY)
  }

  // Right-aligned title stack. The title's right edge sits at W - MX, so it
  // never collides with the logo on the left.
  rText(L.quotation, W - MX, HDR_TOP, 22, fontB, NAVY)
  let metaY = HDR_TOP - 22
  rText(quotation.reference_number, W - MX, metaY, 10, fontB, C.ink)
  metaY -= 13
  if (quotation.title) {
    rText(quotation.title, W - MX, metaY, 9, fontR, C.muted)
    metaY -= 12
  }

  // 1.5pt navy rule below the header
  y = HDR_TOP - LOGO_H - 14
  rule(y, NAVY, MX, W - MX, 1.5)
  y -= 24

  // ── FROM / BILL TO — two text columns, no boxes ──────────────────────────
  const half = (col - 24) / 2
  const LX = MX
  const RX = MX + half + 24
  const secTopY = y

  // Left: FROM
  text(lang === 'en' ? 'FROM' : 'OD', LX, y, 7.5, fontB, NAVY)
  y -= 14
  text(tenant.name, LX, y, 11, fontB, C.ink)
  y -= 14
  if (tenant.contact_person) {
    for (const line of wrapText(tenant.contact_person, fontR, 9, half)) {
      text(line, LX, y, 9, fontR, C.muted); y -= 12
    }
  }
  if (tenant.company_address) {
    for (const line of wrapText(tenant.company_address, fontR, 9, half)) {
      text(line, LX, y, 9, fontR, C.muted); y -= 12
    }
  }
  if (tenant.company_phone)   { text(tenant.company_phone,   LX, y, 9, fontR, C.muted);  y -= 12 }
  if (tenant.company_email)   { text(tenant.company_email,   LX, y, 9, fontR, C.accent); y -= 12 }
  if (tenant.company_website) { text(tenant.company_website, LX, y, 9, fontR, C.muted);  y -= 12 }
  if (tenant.vat_number)         { text(`${L.vatNumber} ${tenant.vat_number}`,         LX, y, 8, fontR, C.faint); y -= 11 }
  if (tenant.company_reg_number) { text(`${L.regNumber} ${tenant.company_reg_number}`, LX, y, 8, fontR, C.faint); y -= 11 }
  const leftBotY = y

  // Right: BILL TO
  let ry = secTopY
  text(L.billTo, RX, ry, 7.5, fontB, NAVY)
  ry -= 14
  text(quotation.customer_name, RX, ry, 11, fontB, C.ink)
  ry -= 14
  if (quotation.customer_company) {
    for (const line of wrapText(quotation.customer_company, fontR, 9, half)) {
      text(line, RX, ry, 9, fontR, C.muted); ry -= 12
    }
  }
  if (quotation.customer_address) {
    for (const line of wrapText(quotation.customer_address, fontR, 9, half)) {
      text(line, RX, ry, 9, fontR, C.muted); ry -= 12
    }
  }
  if (quotation.customer_phone) { text(quotation.customer_phone, RX, ry, 9, fontR, C.muted);  ry -= 12 }
  if (quotation.customer_email) { text(quotation.customer_email, RX, ry, 9, fontR, C.accent); ry -= 12 }
  if (quotation.customer_vat_number) {
    text(`${L.customerVat}: ${quotation.customer_vat_number}`, RX, ry, 8, fontR, C.faint)
    ry -= 11
  }

  y = Math.min(leftBotY, ry) - 8

  // SHIP TO if delivery_address is set — full-width row below the two columns
  if (quotation.delivery_address) {
    rule(y); y -= 14
    text(L.shipTo, MX, y, 7.5, fontB, NAVY)
    y -= 12
    for (const line of wrapText(quotation.delivery_address, fontR, 9, col)) {
      text(line, MX, y, 9, fontR, C.muted); y -= 12
    }
    y -= 4
  }

  y -= 8

  // ── Quote details strip — light gray panel ───────────────────────────────
  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })
  const detailRows: [string, string][] = [
    [L.issued, issueDate],
  ]
  if (quotation.valid_until) {
    detailRows.push([L.validUntil, new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })])
  }
  detailRows.push([L.currency, quotation.currency])
  if (tenant.contact_person)   detailRows.push([L.preparedBy,   tenant.contact_person])
  if (quotation.payment_terms) detailRows.push([L.paymentTerms, quotation.payment_terms])

  // Use up to 4 cells per visual row; if more, wrap onto a second row.
  const cellsPerRow = Math.min(detailRows.length, 4)
  const rowsOfCells = Math.ceil(detailRows.length / cellsPerRow)
  const cellW = col / cellsPerRow
  const STRIP_LINE_H = 11
  const STRIP_PAD    = 14
  const cellInnerW   = cellW - 16
  // Pre-compute wrap counts for each value, so that we can fit the panel exactly.
  const cellWrapLines: number[] = detailRows.map(([, val]) => wrapText(val, fontB, 9, cellInnerW).length)
  const rowMaxLines: number[] = []
  for (let r = 0; r < rowsOfCells; r++) {
    const slice = cellWrapLines.slice(r * cellsPerRow, r * cellsPerRow + cellsPerRow)
    rowMaxLines.push(Math.max(...slice, 1))
  }
  const rowHeights = rowMaxLines.map(n => 12 + n * STRIP_LINE_H)
  const STRIP_H    = rowHeights.reduce((s, n) => s + n, 0) + STRIP_PAD
  ensureSpace(STRIP_H + 22)
  page.drawRectangle({
    x: MX, y: y - STRIP_H, width: col, height: STRIP_H,
    color: PANEL_BG, borderColor: BORDER, borderWidth: 0.5,
  })

  let stripY = y - 14
  for (let r = 0; r < rowsOfCells; r++) {
    const segH = rowHeights[r]
    for (let c = 0; c < cellsPerRow; c++) {
      const idx = r * cellsPerRow + c
      if (idx >= detailRows.length) break
      const [label, value] = detailRows[idx]
      const cx = MX + cellW * c + 12
      text(label.toUpperCase(), cx, stripY, 6.5, fontB, C.muted)
      let valY = stripY - 11
      for (const line of wrapText(value, fontB, 9, cellInnerW)) {
        text(line, cx, valY, 9, fontB, C.ink)
        valY -= STRIP_LINE_H
      }
    }
    // Vertical separator lines between cells
    for (let c = 1; c < cellsPerRow; c++) {
      const sx = MX + cellW * c
      page.drawLine({
        start: { x: sx, y: stripY + 4 },
        end:   { x: sx, y: stripY + 4 - segH + 6 },
        thickness: 0.4, color: BORDER,
      })
    }
    stripY -= segH
  }
  y -= STRIP_H + 24

  // ── Line items ────────────────────────────────────────────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    sectionHeading(L.lineItems)

    const C_NUM  = MX + 6
    const C_PROD = MX + 24
    const C_QTY  = MX + col * 0.55
    const C_UOM  = MX + col * 0.63
    const C_UPR  = MX + col * 0.83
    const C_TR   = MX + col - 6
    const PROD_W = C_QTY - C_PROD - 6

    // Filled navy header row
    const HDR_H_ROW = 22
    ensureSpace(HDR_H_ROW + 6)
    page.drawRectangle({ x: MX, y: y - HDR_H_ROW, width: col, height: HDR_H_ROW, color: NAVY })
    const hbY = y - 14
    text('#',          C_NUM,  hbY, 8, fontB, C.white)
    text(L.product,    C_PROD, hbY, 8, fontB, C.white)
    text(L.qty,        C_QTY,  hbY, 8, fontB, C.white)
    text(L.uom,        C_UOM,  hbY, 8, fontB, C.white)
    rText(L.unitPrice, C_UPR,  hbY, 8, fontB, C.white)
    rText(L.total,     C_TR,   hbY, 8, fontB, C.white)
    // Leave breathing room between the filled header bar and the first
    // item's product name (size 10 text extends ~10pt above its baseline).
    y -= HDR_H_ROW + 16

    for (let i = 0; i < items.length; i++) {
      const item         = items[i]
      const baseLine     = item.unit_price * item.quantity
      const itemAdjs     = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal    = calcLineTotal(item)
      const cfg             = Array.isArray(item.configuration) ? item.configuration : []
      const allFormulas     = Array.isArray(item.formulas) ? item.formulas : []
      const formulaSum      = allFormulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
      // Zero-amount formulas add no price information for the customer —
      // skip them entirely so the PDF only shows formulas that actually
      // contribute to the line total.
      const formulas        = allFormulas.filter(f => (Number(f.amount) || 0) !== 0)
      const ptexts          = (productTexts?.[item.product_id] ?? []).filter(pt => pt.language === lang)
      const modifierSum     = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
      const derivedBase     = item.unit_price - modifierSum - formulaSum
      const showBreakdown   = (cfg.length > 0 || formulas.length > 0)
        && isSectionVisible(layoutSections, 'price-breakdown')

      const nameLines = wrapText(item.product_name, fontB, 10, PROD_W)
      let rh = nameLines.length * 13
      if (item.product_sku)    rh += 11
      if (showBreakdown)       rh += 11 + (cfg.length + formulas.length) * 11
      for (const pt of ptexts) rh += 11 + wrapText(pt.content, fontR, 8, PROD_W - 4).length * 11
      if (itemAdjs.length > 0) rh += 4 + 11 + itemAdjs.length * 11
      rh += 14
      ensureSpace(rh)

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
      if (i < items.length - 1)
        page.drawLine({ start: { x: MX, y: y + 4 }, end: { x: MX + col, y: y + 4 }, thickness: 0.3, color: BORDER })
    }
    y -= 14
  }

  // ── Financial summary — right-aligned, total in navy bar ─────────────────
  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const SUM_W = 250
  const SUM_L = W - MX - SUM_W
  const SUM_R = W - MX

  ensureSpace(40 + adjustments.length * 16 + 36)
  rule(y, BORDER, SUM_L, SUM_R, 0.5)
  y -= 16

  text(L.subtotal, SUM_L, y, 9.5, fontR, C.muted)
  rText(`${quotation.subtotal.toFixed(2)} ${quotation.currency}`, SUM_R, y, 9.5, fontR, C.ink)
  y -= 16

  let running = quotation.subtotal
  for (const adj of adjustments) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    if (adj.type !== 'discount') running += amount
    else running -= amount

    const pct    = adj.mode === 'percent' ? ` ${adj.value}%` : ''
    const label  = `${adj.label}${pct}`
    text(label, SUM_L, y, 9, fontR, C.muted)
    rText(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${quotation.currency}`,
      SUM_R, y, 9, fontB, applied >= 0 ? C.positive : C.negative)
    y -= 16
  }

  // Total bar — navy fill. Both texts share the same baseline inside the bar.
  ensureSpace(40)
  y -= 4
  const TOT_H = 30
  const TOT_BASELINE = y - 19   // baseline inside the band — same for both texts
  page.drawRectangle({ x: SUM_L, y: y - TOT_H, width: SUM_W, height: TOT_H, color: NAVY })
  text(L.totalDue, SUM_L + 14, TOT_BASELINE, 9, fontB, rgb(0.78, 0.82, 0.88))
  rText(`${quotation.total_price.toFixed(2)} ${quotation.currency}`,
    SUM_R - 14, TOT_BASELINE, 13, fontB, C.white)
  y -= TOT_H + 22

  // ── Notes / terms / global texts — plain sections with navy heading rule
  function drawSimpleSection(label: string, lines: string[]) {
    if (!lines.length) return
    sectionHeading(label)
    for (const raw of lines) {
      for (const line of wrapText(raw, fontR, 9.5, col)) {
        ensureSpace(13)
        text(line, MX, y, 9.5, fontR, C.ink)
        y -= 13
      }
    }
    y -= 8
  }

  function drawNotesSection() {
    if (!quotation.notes) return
    drawSimpleSection(L.notes, quotation.notes.split(/\r?\n/))
  }

  function drawTermsSection() {
    drawSimpleSection(L.termsHeader, L.termsLines)
  }

  function drawGlobalTextSection(txt: ProductText) {
    drawSimpleSection(txt.label.toUpperCase(), txt.content.split(/\r?\n/))
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
    pg.drawText(label, { x: W / 2 - lw / 2, y: MB - 16, size: 7.5, font: fontR, color: C.muted })
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
