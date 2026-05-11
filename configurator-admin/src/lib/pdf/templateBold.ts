import { PDFDocument, PDFPage, PDFFont, rgb, degrees } from 'pdf-lib'
import type { QuotationLineItem, QuotationAdjustment, ProductText } from '@/types/database'
import { calcLineTotal } from '@/lib/quotations'
import {
  C, wrapText, PDF_LABELS, loadFonts, loadLogo, getFooterLabel,
  isSectionVisible, buildOrderedSections,
  type PdfBuildArgs,
} from './shared'

/**
 * Bold — refined editorial. Narrow vertical accent stripe on the left edge.
 * The header lays out as: logo top-left, dates right-aligned, then the
 * "QUOTATION" hero title + reference stacked BELOW the logo (so the hero
 * never collides with the logo or the dates). Coral accent appears on
 * section headings and the total. Generous whitespace.
 */
export async function renderBold(args: PdfBuildArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang, watermark } = args
  const L = PDF_LABELS[lang]
  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)

  const ACCENT      = rgb(0.910, 0.290, 0.118)   // #E84A1E
  const ACCENT_SOFT = rgb(0.992, 0.953, 0.945)   // #FDF3F1

  const W = 595, H = 842
  const ACCENT_W = 6                  // left accent stripe
  const MX_L     = ACCENT_W + 36      // body left edge
  const MX_R     = 36                 // body right margin from page edge
  // Footer position is absolute (from page bottom). MB is the safe content
  // threshold and is set well above the footer rule so long lists never
  // overlap the footer line.
  const FOOTER_BASELINE = 28
  const FOOTER_RULE_Y   = FOOTER_BASELINE + 12
  const MB              = FOOTER_RULE_Y + 24
  const col      = W - MX_L - MX_R

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  function drawAccentStripe() {
    page.drawRectangle({ x: 0, y: 0, width: ACCENT_W, height: H, color: ACCENT })
  }

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    drawAccentStripe()
    y = H - 32
    text(`${tenant.name.toUpperCase()} — ${L.quotation} ${quotation.reference_number}`,
      MX_L, y, 8, fontB, C.muted)
    y -= 8
    rule(y, ACCENT, MX_L, W - MX_R, 1)
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

  function rule(yPos: number, color = C.rule, x1 = MX_L, x2 = W - MX_R, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color })
  }

  function sectionHeading(label: string) {
    ensureSpace(20)
    text(label.toUpperCase(), MX_L, y, 8, fontB, ACCENT)
    y -= 6
    rule(y, ACCENT, MX_L, W - MX_R, 1)
    y -= 14
  }

  function drawFooter() {
    rule(FOOTER_RULE_Y, ACCENT, MX_L, W - MX_R, 1)
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }))
      : L.contactText
    text(validStr, MX_L, FOOTER_BASELINE, 7.5, fontR, C.muted)
    rText(getFooterLabel(tenant, L.footer), W - MX_R, FOOTER_BASELINE, 7.5, fontB, ACCENT)
  }

  drawAccentStripe()
  const logoImg = await loadLogo(pdfDoc, tenant.logo_url)

  // ── Header ────────────────────────────────────────────────────────────────
  // Layout (no horizontal collisions):
  //   • Logo (or company name) top-left
  //   • Right-aligned dates stack at the same vertical band as the logo
  //   • Title "QUOTATION" + reference stacked BELOW the logo
  //   • Coral 1pt rule under the header
  const HDR_TOP = H - 50
  const LOGO_W  = 130, LOGO_H = 42

  if (logoImg) {
    const dims = logoImg.scaleToFit(LOGO_W, LOGO_H)
    page.drawImage(logoImg, {
      x: MX_L,
      y: HDR_TOP - dims.height + 6,
      width: dims.width, height: dims.height,
    })
  } else {
    text(tenant.name.toUpperCase(), MX_L, HDR_TOP - 4, 12, fontB, C.muted)
  }

  // Right-side meta stack
  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })
  let metaY = HDR_TOP
  rText(L.issued.toUpperCase(), W - MX_R, metaY, 7, fontB, C.muted)
  metaY -= 11
  rText(issueDate, W - MX_R, metaY, 9.5, fontB, C.ink)
  metaY -= 16
  if (quotation.valid_until) {
    rText(L.validUntil.toUpperCase(), W - MX_R, metaY, 7, fontB, C.muted)
    metaY -= 11
    rText(
      new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }),
      W - MX_R, metaY, 9.5, fontB, ACCENT,
    )
    metaY -= 16
  }

  // Hero — placed BELOW the logo so it never overlaps it.
  const heroY = HDR_TOP - LOGO_H - 16
  text(L.quotation, MX_L, heroY, 26, fontB, ACCENT)
  // 26pt hero descender clears at heroY - ~6pt; place reference at heroY - 22.
  text(quotation.reference_number, MX_L, heroY - 22, 12, fontB, C.ink)
  if (quotation.title) {
    const refW = fontB.widthOfTextAtSize(quotation.reference_number, 12)
    text(quotation.title, MX_L + refW + 14, heroY - 22, 10, fontR, C.muted)
  }

  y = heroY - 38
  rule(y, ACCENT, MX_L, W - MX_R, 1)
  y -= 24

  // ── FROM / TO — two columns ──────────────────────────────────────────────
  const half = (col - 24) / 2
  const LX = MX_L
  const RX = MX_L + half + 24
  const secTopY = y

  text((lang === 'en' ? 'FROM' : 'OD'), LX, y, 8, fontB, ACCENT)
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

  let ry = secTopY
  text((lang === 'en' ? 'TO' : 'ZA'), RX, ry, 8, fontB, ACCENT)
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

  // SHIP TO if delivery_address is set — full-width row below
  if (quotation.delivery_address) {
    text(L.shipTo, MX_L, y, 8, fontB, ACCENT)
    y -= 12
    for (const line of wrapText(quotation.delivery_address, fontR, 9, col)) {
      text(line, MX_L, y, 9, fontR, C.muted); y -= 12
    }
    y -= 4
  }

  // Currency / prepared by / payment terms — meta strip
  const metaParts: [string, string][] = [
    [L.currency, quotation.currency],
  ]
  if (tenant.contact_person)   metaParts.push([L.preparedBy,   tenant.contact_person])
  if (quotation.payment_terms) metaParts.push([L.paymentTerms, quotation.payment_terms])

  if (metaParts.length > 0) {
    y -= 6
    rule(y, C.rule)
    y -= 14
    const mCol = col / metaParts.length
    let metaRowMaxLines = 1
    for (let i = 0; i < metaParts.length; i++) {
      const [label, value] = metaParts[i]
      const cx = MX_L + mCol * i
      text(label.toUpperCase(), cx, y, 7, fontB, ACCENT)
      const valueLines = wrapText(value, fontR, 9, mCol - 12)
      let valueY = y - 11
      for (const line of valueLines) {
        text(line, cx, valueY, 9, fontR, C.ink)
        valueY -= 11
      }
      metaRowMaxLines = Math.max(metaRowMaxLines, valueLines.length)
    }
    y -= 14 + metaRowMaxLines * 11
  }

  rule(y, C.rule)
  y -= 22

  // ── Line items ────────────────────────────────────────────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    sectionHeading(L.lineItems)

    const C_NUM  = MX_L
    const C_PROD = MX_L + 22
    const C_QTY  = MX_L + col * 0.55
    const C_UOM  = MX_L + col * 0.63
    const C_UPR  = MX_L + col * 0.83
    const C_TR   = W - MX_R
    const PROD_W = C_QTY - C_PROD - 6

    text('#',          C_NUM,  y, 7, fontB, C.muted)
    text(L.product,    C_PROD, y, 7, fontB, C.muted)
    text(L.qty,        C_QTY,  y, 7, fontB, C.muted)
    text(L.uom,        C_UOM,  y, 7, fontB, C.muted)
    rText(L.unitPrice, C_UPR,  y, 7, fontB, C.muted)
    rText(L.total,     C_TR,   y, 7, fontB, C.muted)
    y -= 6
    rule(y, ACCENT, MX_L, W - MX_R, 1)
    y -= 14

    for (let i = 0; i < items.length; i++) {
      const item        = items[i]
      const baseLine    = item.unit_price * item.quantity
      const itemAdjs    = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal   = calcLineTotal(item)
      const cfg         = Array.isArray(item.configuration) ? item.configuration : []
      const allFormulas = Array.isArray(item.formulas) ? item.formulas : []
      const formulaSum  = allFormulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
      const formulas    = allFormulas.filter(f => (Number(f.amount) || 0) !== 0)
      const ptexts      = (productTexts?.[item.product_id] ?? []).filter(pt => pt.language === lang)
      const modifierSum = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
      const derivedBase = item.unit_price - modifierSum - formulaSum
      const showBreakdown = cfg.length > 0 || formulas.length > 0

      const nameLines = wrapText(item.product_name, fontB, 11, PROD_W)
      let rh = nameLines.length * 14
      if (item.product_sku)    rh += 11
      if (showBreakdown)       rh += 11 + (cfg.length + formulas.length) * 11
      for (const pt of ptexts) rh += 11 + wrapText(pt.content, fontR, 8, PROD_W - 4).length * 11
      if (itemAdjs.length > 0) rh += 4 + 11 + itemAdjs.length * 11
      rh += 14
      ensureSpace(rh)

      const rowY = y

      text(`${i + 1}`, C_NUM, y, 9, fontR, C.faint)

      for (const line of nameLines) {
        text(line, C_PROD, y, 11, fontB, C.ink)
        y -= 14
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
        text(`${pt.label}:`, C_PROD + 4, y, 7.5, fontB, ACCENT)
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

      text(String(item.quantity),       C_QTY, rowY, 10, fontR, C.ink)
      text(item.unit_of_measure ?? '—', C_UOM, rowY, 10, fontR, C.muted)
      rText(item.unit_price.toFixed(2), C_UPR, rowY, 10, fontR, C.ink)
      rText(lineTotal.toFixed(2),       C_TR,  rowY, 10, fontB, ACCENT)

      y -= 10
      if (i < items.length - 1)
        page.drawLine({
          start: { x: MX_L, y: y + 4 }, end: { x: W - MX_R, y: y + 4 },
          thickness: 0.25, color: C.rule,
        })
    }
    y -= 14
  }

  // ── Financial summary ─────────────────────────────────────────────────────
  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const SUM_W = 260
  const SUM_L = W - MX_R - SUM_W
  const SUM_R = W - MX_R

  ensureSpace(40 + adjustments.length * 16 + 36)
  rule(y, C.rule, SUM_L, SUM_R)
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

  // Total band — soft tint behind a single baseline. Both texts use the same y.
  ensureSpace(40)
  y -= 6
  const TOT_H = 32
  const TOT_BASELINE = y - 21
  page.drawRectangle({
    x: SUM_L - 12, y: y - TOT_H, width: SUM_W + 12, height: TOT_H,
    color: ACCENT_SOFT,
  })
  page.drawRectangle({
    x: SUM_L - 12, y: y - TOT_H, width: 4, height: TOT_H,
    color: ACCENT,
  })
  text(L.totalDue, SUM_L, TOT_BASELINE, 9, fontB, C.muted)
  rText(`${quotation.total_price.toFixed(2)} ${quotation.currency}`,
    SUM_R, TOT_BASELINE, 14, fontB, ACCENT)
  y -= TOT_H + 24

  // ── Notes / terms / global texts ────────────────────────────────────────
  function drawSimpleSection(label: string, lines: string[]) {
    if (!lines.length) return
    sectionHeading(label)
    for (const raw of lines) {
      for (const line of wrapText(raw, fontR, 9.5, col)) {
        ensureSpace(13)
        text(line, MX_L, y, 9.5, fontR, C.ink)
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
