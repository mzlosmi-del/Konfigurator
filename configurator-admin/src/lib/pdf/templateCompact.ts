import { PDFDocument, PDFPage, PDFFont, rgb, degrees } from 'pdf-lib'
import type { QuotationLineItem, QuotationAdjustment } from '@/types/database'
import { calcLineTotal } from '@/lib/quotations'
import {
  C, wrapText, labelsFor, loadFonts, loadLogo, getFooterLabel, getTermsLines,
  isSectionVisible, isSectionVisibleOptIn, resolveCharDescription, buildOrderedSections,
  type PdfBuildArgs,
} from './shared'
import { resolveProductTextBlocks, resolveTenantTextBlocks, type ResolvedTextBlock } from '@/lib/texts'

/**
 * Compact — same content as Modern but laid out for density: tighter margins
 * and smaller type. Shows the full configuration breakdown, formulas,
 * product texts, and per-item adjustments — no summarisation. Targets short
 * quotes that should fit on a single page.
 */
export async function renderCompact(args: PdfBuildArgs): Promise<Uint8Array> {
  const { tenant, quotation, texts = [], layoutSections, lang, watermark } = args
  const tenantBlocks = resolveTenantTextBlocks(texts, lang)
  const L = labelsFor(lang)
  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)

  const W = 595, H = 842
  const MX = 32
  // Footer position is absolute (from page bottom). MB is the safe content
  // threshold and is kept well above the footer rule so long lists never
  // overlap it.
  const FOOTER_BASELINE = 20
  const FOOTER_RULE_Y   = FOOTER_BASELINE + 10
  const MB              = FOOTER_RULE_Y + 20
  const col = W - MX * 2

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    y = H - 24
    text(`${tenant.name} · ${L.quotation} ${quotation.reference_number}`,
      MX, y, 7, fontR, C.faint)
    y -= 6
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

  function rule(yPos: number, color = C.rule, x1 = MX, x2 = W - MX, thickness = 0.4) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color })
  }

  function sectionLabel(label: string) {
    ensureSpace(14)
    text(label, MX, y, 6.5, fontB, C.muted)
    y -= 4
    rule(y)
    y -= 10
  }

  function drawFooter() {
    rule(FOOTER_RULE_Y, C.rule)
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'short' }))
      : L.contactText
    text(validStr, MX, FOOTER_BASELINE, 7, fontR, C.muted)
    rText(getFooterLabel(tenant, L.footer, texts, lang), W - MX, FOOTER_BASELINE, 7, fontR, C.faint)
  }

  const logoImg = await loadLogo(pdfDoc, tenant.logo_url)

  // ── Header (compact) ──────────────────────────────────────────────────────
  const HDR_TOP = H - 30
  const LOGO_W  = 100, LOGO_H = 32

  if (logoImg) {
    const dims = logoImg.scaleToFit(LOGO_W, LOGO_H)
    page.drawImage(logoImg, {
      x: MX, y: HDR_TOP - dims.height + 4,
      width: dims.width, height: dims.height,
    })
  } else {
    text(tenant.name.toUpperCase(), MX, HDR_TOP, 11, fontB, C.ink)
  }

  rText(L.quotation, W - MX, HDR_TOP, 16, fontB, C.ink)
  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'medium' })
  let metaY = HDR_TOP - 14
  rText(quotation.reference_number, W - MX, metaY, 8, fontB, C.muted)
  metaY -= 10
  if (quotation.title) {
    rText(quotation.title, W - MX, metaY, 7.5, fontR, C.muted)
    metaY -= 9
  }
  rText(`${L.issued}: ${issueDate}`, W - MX, metaY, 7, fontR, C.faint)
  metaY -= 9
  if (quotation.valid_until) {
    const expDate = new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'medium' })
    rText(`${L.validUntil}: ${expDate}`, W - MX, metaY, 7, fontR, C.faint)
  }

  y = HDR_TOP - LOGO_H - 8
  rule(y)
  y -= 14

  // ── Sender contact strip ─────────────────────────────────────────────────
  const senderParts = [
    tenant.contact_person,
    tenant.company_address,
    tenant.company_phone,
    tenant.company_email,
    tenant.company_website,
    tenant.vat_number         ? `${L.vatNumber} ${tenant.vat_number}`         : null,
    tenant.company_reg_number ? `${L.regNumber} ${tenant.company_reg_number}` : null,
  ].filter(Boolean) as string[]
  if (senderParts.length) {
    text(tenant.name, MX, y, 8.5, fontB, C.ink)
    y -= 10
    for (const line of wrapText(senderParts.join(' · '), fontR, 7.5, col)) {
      text(line, MX, y, 7.5, fontR, C.muted)
      y -= 9
    }
  }

  y -= 6
  rule(y)
  y -= 14

  // ── Bill To + Quote details (two columns) ────────────────────────────────
  const half  = (col - 16) / 2
  const LX    = MX
  const RX    = MX + half + 16
  const secTopY = y

  text(L.billTo, LX, y, 6.5, fontB, C.muted)
  y -= 10
  text(quotation.customer_name, LX, y, 9.5, fontB, C.ink)
  y -= 11
  if (quotation.customer_company) { text(quotation.customer_company, LX, y, 8, fontR, C.muted);  y -= 10 }
  if (quotation.customer_email)   { text(quotation.customer_email,   LX, y, 8, fontR, C.accent); y -= 10 }
  if (quotation.customer_phone)   { text(quotation.customer_phone,   LX, y, 8, fontR, C.muted);  y -= 10 }
  if (quotation.customer_address) {
    for (const line of wrapText(quotation.customer_address, fontR, 8, half)) {
      text(line, LX, y, 8, fontR, C.muted); y -= 10
    }
  }
  if (quotation.customer_vat_number) {
    text(`${L.customerVat}: ${quotation.customer_vat_number}`, LX, y, 7.5, fontR, C.faint)
    y -= 10
  }
  if (quotation.delivery_address) {
    y -= 4
    text(L.shipTo, LX, y, 6.5, fontB, C.muted)
    y -= 10
    for (const line of wrapText(quotation.delivery_address, fontR, 8, half)) {
      text(line, LX, y, 8, fontR, C.muted); y -= 10
    }
  }
  const leftBotY = y

  let ry = secTopY
  text(L.quoteDetails, RX, ry, 6.5, fontB, C.muted)
  ry -= 10

  function detailRow(label: string, value: string) {
    text(label, RX, ry, 7.5, fontR, C.muted)
    const wrapped = wrapText(value, fontB, 8, half / 2)
    rText(wrapped[0] ?? '', W - MX, ry, 8, fontB, C.ink)
    ry -= 10
    for (let i = 1; i < wrapped.length; i++) {
      rText(wrapped[i], W - MX, ry, 8, fontB, C.ink)
      ry -= 10
    }
  }

  detailRow(L.reference, quotation.reference_number)
  detailRow(L.issued,    issueDate)
  if (quotation.valid_until) {
    detailRow(L.validUntil, new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'medium' }))
  }
  detailRow(L.currency, quotation.currency)
  if (tenant.contact_person)   detailRow(L.preparedBy,   tenant.contact_person)
  if (quotation.payment_terms) detailRow(L.paymentTerms, quotation.payment_terms)

  y = Math.min(leftBotY, ry) - 6
  rule(y)
  y -= 12

  // ── Line items ────────────────────────────────────────────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    sectionLabel(L.lineItems)

    const C_NUM  = MX
    const C_PROD = MX + 14
    const C_QTY  = MX + col * 0.55
    const C_UOM  = MX + col * 0.62
    const C_UPR  = MX + col * 0.82
    const C_TR   = MX + col
    const PROD_W = C_QTY - C_PROD - 6

    text('#',          C_NUM,  y, 6.5, fontB, C.muted)
    text(L.product,    C_PROD, y, 6.5, fontB, C.muted)
    text(L.qty,        C_QTY,  y, 6.5, fontB, C.muted)
    text(L.uom,        C_UOM,  y, 6.5, fontB, C.muted)
    rText(L.unitPrice, C_UPR,  y, 6.5, fontB, C.muted)
    rText(L.total,     C_TR,   y, 6.5, fontB, C.muted)
    y -= 4
    rule(y, C.ink, MX, MX + col, 0.5)
    y -= 10

    for (let i = 0; i < items.length; i++) {
      const item        = items[i]
      const baseLine    = item.unit_price * item.quantity
      const itemAdjs    = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal   = calcLineTotal(item)
      const cfg         = Array.isArray(item.configuration) ? item.configuration : []
      const allFormulas = Array.isArray(item.formulas) ? item.formulas : []
      const formulaSum  = allFormulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
      const formulas    = allFormulas.filter(f => (Number(f.amount) || 0) !== 0)
      const ptexts      = resolveProductTextBlocks(texts, item.product_id, lang)
      const modifierSum = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
      const derivedBase = item.unit_price - modifierSum - formulaSum
      const showBreakdown = (cfg.length > 0 || formulas.length > 0)
        && isSectionVisible(layoutSections, 'price-breakdown')
      const showDescriptions = showBreakdown
        && isSectionVisibleOptIn(layoutSections, 'characteristic-descriptions')
      const descLines: Record<string, string[]> = {}
      if (showDescriptions) {
        for (const c of cfg) {
          const desc = resolveCharDescription(c.characteristic_description_i18n, lang)
          if (desc) descLines[c.characteristic_id] = wrapText(desc, fontR, 6.5, PROD_W - 12)
        }
      }
      const descLineCount = Object.values(descLines).reduce((s, ls) => s + ls.length, 0)

      const nameLines = wrapText(item.product_name, fontB, 9, PROD_W)
      let rh = nameLines.length * 11
      if (item.product_sku)    rh += 9
      if (showBreakdown)       rh += 9 + (cfg.length + formulas.length) * 9 + descLineCount * 8
      for (const pt of ptexts) rh += 9 + wrapText(pt.content, fontR, 7, PROD_W - 4).length * 9
      if (itemAdjs.length > 0) rh += 4 + 9 + itemAdjs.length * 9
      rh += 8
      ensureSpace(rh)

      if (i % 2 === 1)
        page.drawRectangle({ x: MX, y: y - rh + 2, width: col, height: rh, color: C.rowAlt })

      const rowY = y

      text(`${i + 1}`, C_NUM, y, 7.5, fontR, C.faint)

      for (const line of nameLines) {
        text(line, C_PROD, y, 9, fontB, C.ink)
        y -= 11
      }
      if (item.product_sku) {
        text(`SKU: ${item.product_sku}`, C_PROD, y, 6.5, fontR, C.muted)
        y -= 9
      }

      if (showBreakdown) {
        text(L.basePrice, C_PROD + 4, y, 7, fontR, C.muted)
        rText(derivedBase.toFixed(2), C_TR, y, 7, fontR, C.muted)
        y -= 9
        for (const c of cfg) {
          text(c.value_label ? `+ ${c.characteristic_name}: ${c.value_label}` : `+ ${c.characteristic_name}`, C_PROD + 4, y, 7, fontR, C.muted)
          const mod      = Number(c.price_modifier) || 0
          const modStr   = mod === 0 ? '—' : `${mod >= 0 ? '+' : ''}${mod.toFixed(2)}`
          const modColor = mod > 0 ? C.positive : mod < 0 ? C.negative : C.muted
          rText(modStr, C_TR, y, 7, fontR, modColor)
          y -= 9
          const lines = descLines[c.characteristic_id]
          if (lines) {
            for (const line of lines) {
              text(line, C_PROD + 12, y, 6.5, fontR, C.faint)
              y -= 8
            }
          }
        }
        for (const f of formulas) {
          text(`ƒ ${f.formula_name}`, C_PROD + 4, y, 7, fontR, C.muted)
          const amt      = Number(f.amount) || 0
          const amtStr   = amt === 0 ? '—' : `${amt >= 0 ? '+' : ''}${amt.toFixed(2)}`
          const amtColor = amt > 0 ? C.positive : amt < 0 ? C.negative : C.muted
          rText(amtStr, C_TR, y, 7, fontR, amtColor)
          y -= 9
        }
      }

      for (const pt of ptexts) {
        text(`${pt.label ?? pt.slot}:`, C_PROD + 4, y, 6.5, fontB, C.muted)
        y -= 9
        for (const line of wrapText(pt.content, fontR, 7, PROD_W - 4)) {
          text(line, C_PROD + 8, y, 7, fontR, C.muted)
          y -= 9
        }
      }

      if (itemAdjs.length > 0) {
        y -= 4
        text(L.subtotal, C_PROD + 4, y, 7, fontR, C.muted)
        rText(baseLine.toFixed(2), C_TR, y, 7, fontR, C.muted)
        y -= 9
        let runItem = baseLine
        for (const adj of itemAdjs) {
          const amt     = adj.mode === 'percent' ? (runItem * adj.value) / 100 : adj.value
          const applied = adj.type === 'discount' ? -amt : amt
          runItem += applied
          const lbl = `${adj.label || adj.type}${adj.mode === 'percent' ? ` (${adj.value}%)` : ''}`
          text(lbl, C_PROD + 4, y, 7, fontR, C.muted)
          rText(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)}`, C_TR, y, 7, fontR,
            applied >= 0 ? C.positive : C.negative)
          y -= 9
        }
      }

      text(String(item.quantity),       C_QTY, rowY, 8.5, fontR, C.ink)
      text(item.unit_of_measure ?? '—', C_UOM, rowY, 8.5, fontR, C.muted)
      rText(item.unit_price.toFixed(2), C_UPR, rowY, 8.5, fontR, C.ink)
      rText(lineTotal.toFixed(2),       C_TR,  rowY, 9,   fontB, C.ink)

      y -= 4
      if (i < items.length - 1)
        page.drawLine({ start: { x: MX, y: y + 2 }, end: { x: MX + col, y: y + 2 }, thickness: 0.2, color: C.rule })
    }
    y -= 8
  }

  // ── Financial summary — right-aligned, inline ────────────────────────────
  rule(y)
  y -= 10

  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const SUM_W = 200
  const SUM_L = W - MX - SUM_W
  const SUM_R = W - MX

  text(L.subtotal, SUM_L, y, 8, fontR, C.muted)
  rText(`${quotation.subtotal.toFixed(2)} ${quotation.currency}`, SUM_R, y, 8, fontR, C.ink)
  y -= 12

  let running = quotation.subtotal
  for (const adj of adjustments) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    if (adj.type !== 'discount') running += amount
    else running -= amount

    const pct    = adj.mode === 'percent' ? ` ${adj.value}%` : ''
    const label  = `${adj.label}${pct}`
    text(label, SUM_L, y, 7.5, fontR, C.muted)
    rText(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${quotation.currency}`,
      SUM_R, y, 7.5, fontB, applied >= 0 ? C.positive : C.negative)
    y -= 11
  }

  ensureSpace(22)
  rule(y, C.ink, SUM_L, SUM_R, 0.6)
  y -= 14
  text(L.totalDue, SUM_L, y, 8, fontB, C.muted)
  rText(`${quotation.total_price.toFixed(2)} ${quotation.currency}`, SUM_R, y, 12, fontB, C.ink)
  y -= 18

  // ── Notes / terms / global texts ────────────────────────────────────────
  function drawSimpleSection(label: string, lines: string[]) {
    if (!lines.length) return
    y -= 4
    sectionLabel(label)
    for (const raw of lines) {
      for (const line of wrapText(raw, fontR, 8, col)) {
        ensureSpace(10)
        text(line, MX, y, 8, fontR, C.ink)
        y -= 10
      }
    }
    y -= 4
  }

  function drawNotesSection() {
    if (!quotation.notes) return
    drawSimpleSection(L.notes, quotation.notes.split(/\r?\n/))
  }

  function drawTermsSection() {
    drawSimpleSection(L.termsHeader, [...getTermsLines(texts, L.termsLines, lang)])
  }

  function drawGlobalTextSection(txt: ResolvedTextBlock) {
    drawSimpleSection((txt.label ?? txt.slot).toUpperCase(), txt.content.split(/\r?\n/))
  }

  const orderedSections = buildOrderedSections(layoutSections, tenantBlocks, lang)

  for (const section of orderedSections) {
    if (!section.visible) continue
    if (section.id === 'notes') {
      if (isSectionVisible(layoutSections, 'notes')) drawNotesSection()
    } else if (section.id === 'terms') {
      if (isSectionVisible(layoutSections, 'terms')) drawTermsSection()
    } else if (section.textId) {
      const gt = tenantBlocks.find(b => b.id === section.textId)
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
