import { PDFDocument, PDFPage, PDFFont, rgb, degrees } from 'pdf-lib'
import type { QuotationLineItem, QuotationAdjustment } from '@/types/database'
import { calcLineTotal } from '@/lib/quotations'
import {
  C, wrapText, PDF_LABELS, loadFonts, loadLogo, getFooterLabel, getTermsLines,
  isSectionVisible, isSectionVisibleOptIn, resolveCharDescription, buildOrderedSections,
  type PdfBuildArgs,
} from './shared'
import { resolveProductTextBlocks, resolveTenantTextBlocks, type ResolvedTextBlock } from '@/lib/texts'

/**
 * Modern — current default. Minimal light palette, no filled colour rectangles
 * outside subtle row tints and the terms box. Hierarchy comes from typography
 * and thin rules.
 */
export async function renderModern(args: PdfBuildArgs): Promise<Uint8Array> {
  const { tenant, quotation, texts = [], layoutSections, lang, watermark } = args
  const L = PDF_LABELS[lang]
  const tenantBlocks = resolveTenantTextBlocks(texts, lang)
  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)

  const W = 595, H = 842
  const MX = 48
  // Footer position is absolute (from page bottom). MB is the safe content
  // threshold and is kept well above the footer rule so long lists never
  // overlap it.
  const FOOTER_BASELINE = 24
  const FOOTER_RULE_Y   = FOOTER_BASELINE + 12
  const MB              = FOOTER_RULE_Y + 24
  const col = W - MX * 2

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    y = H - 28
    text(tenant.name.toUpperCase(), MX, y, 7.5, fontB, C.muted)
    rText(`${L.quotation} — ${quotation.reference_number}`, W - MX, y, 7.5, fontR, C.faint)
    y -= 10
    rule(y)
    y -= 20
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
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.5, color })
  }

  function sectionLabel(label: string) {
    text(label, MX, y, 7, fontB, C.muted)
    y -= 5
    rule(y)
    y -= 14
  }

  function drawFooter() {
    rule(FOOTER_RULE_Y)
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }))
      : L.contactText
    text(validStr, MX, FOOTER_BASELINE, 7.5, fontR, C.muted)
    rText(getFooterLabel(tenant, L.footer, texts, lang), W - MX, FOOTER_BASELINE, 7.5, fontR, C.faint)
  }

  const logoImg = await loadLogo(pdfDoc, tenant.logo_url)

  // ── Header ────────────────────────────────────────────────────────────────
  const HDR_TOP = H - 36
  const LOGO_W  = 148, LOGO_H = 56

  if (logoImg) {
    const dims = logoImg.scaleToFit(LOGO_W, LOGO_H)
    page.drawImage(logoImg, {
      x: MX,
      y: HDR_TOP - dims.height + 4,
      width: dims.width, height: dims.height,
    })
  } else {
    const nameLines = wrapText(tenant.name.toUpperCase(), fontB, 13, LOGO_W)
    let ty = HDR_TOP
    for (const line of nameLines) {
      text(line, MX, ty, 13, fontB, C.ink)
      ty -= 17
    }
  }

  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })
  rText(L.quotation, W - MX, HDR_TOP, 22, fontB, C.ink)

  let metaY = HDR_TOP - 24
  if (quotation.title) {
    rText(quotation.title, W - MX, metaY, 8.5, fontR, C.muted)
    metaY -= 12
  }
  rText(quotation.reference_number, W - MX, metaY, 8.5, fontR, C.muted)
  metaY -= 12
  rText(issueDate, W - MX, metaY, 8, fontR, C.faint)
  metaY -= 10
  if (quotation.valid_until) {
    const expDate = new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })
    rText(`${L.validUntil}: ${expDate}`, W - MX, metaY, 8, fontR, C.faint)
  }

  y = HDR_TOP - LOGO_H - 10
  rule(y)
  y -= 28

  // ── Sender strip ──────────────────────────────────────────────────────────
  text(tenant.name.toUpperCase(), MX, y, 9, fontB, C.ink)

  const senderParts = [
    tenant.contact_person,
    tenant.company_address,
    tenant.company_phone,
    tenant.company_email,
    tenant.company_website,
  ].filter(Boolean) as string[]
  y -= 13
  if (senderParts.length > 0) {
    for (const line of wrapText(senderParts.join('  ·  '), fontR, 8, col)) {
      text(line, MX, y, 8, fontR, C.muted)
      y -= 11
    }
  }
  const tenantRegParts = [
    tenant.vat_number         ? `${L.vatNumber} ${tenant.vat_number}`         : null,
    tenant.company_reg_number ? `${L.regNumber} ${tenant.company_reg_number}` : null,
  ].filter(Boolean) as string[]
  if (tenantRegParts.length > 0) {
    text(tenantRegParts.join('   '), MX, y, 8, fontR, C.faint)
    y -= 11
  }
  y -= 10
  rule(y)
  y -= 26

  // ── Bill To / Quote Details ───────────────────────────────────────────────
  const half    = (col - 32) / 2
  const LX      = MX
  const RX      = MX + half + 32
  const secTopY = y

  text(L.billTo, LX, y, 7, fontB, C.muted)
  y -= 14
  text(quotation.customer_name, LX, y, 12, fontB, C.ink)
  y -= 15
  if (quotation.customer_company) { text(quotation.customer_company, LX, y, 9, fontR, C.ink); y -= 12 }
  text(quotation.customer_email, LX, y, 9, fontR, C.accent)
  y -= 12
  if (quotation.customer_phone) { text(quotation.customer_phone, LX, y, 9, fontR, C.muted); y -= 12 }
  if (quotation.customer_address) {
    for (const line of wrapText(quotation.customer_address, fontR, 9, half)) {
      text(line, LX, y, 9, fontR, C.muted); y -= 12
    }
  }
  if (quotation.customer_vat_number) {
    text(`${L.customerVat}: ${quotation.customer_vat_number}`, LX, y, 8, fontR, C.faint)
    y -= 11
  }
  if (quotation.delivery_address) {
    y -= 6
    text(L.shipTo, LX, y, 7, fontB, C.muted)
    y -= 13
    for (const line of wrapText(quotation.delivery_address, fontR, 9, half)) {
      text(line, LX, y, 9, fontR, C.muted); y -= 12
    }
  }

  let ry = secTopY
  text(L.quoteDetails, RX, ry, 7, fontB, C.muted)
  ry -= 14

  function detailRow(label: string, value: string) {
    text(label, RX, ry, 8.5, fontR, C.muted)
    rText(value, W - MX, ry, 8.5, fontB, C.ink)
    ry -= 14
  }

  detailRow(L.reference, quotation.reference_number)
  detailRow(L.issued, issueDate)
  if (quotation.valid_until) {
    detailRow(L.validUntil, new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }))
  }
  detailRow(L.currency, quotation.currency)
  if (tenant.contact_person) detailRow(L.preparedBy, tenant.contact_person)
  if (quotation.payment_terms) detailRow(L.paymentTerms, quotation.payment_terms)

  const secBotY = Math.min(y, ry) - 8
  page.drawLine({
    start: { x: MX + half + 16, y: secTopY + 4 },
    end:   { x: MX + half + 16, y: secBotY },
    thickness: 0.5, color: C.rule,
  })

  y = secBotY - 18
  rule(y)
  y -= 26

  // ── Line items ────────────────────────────────────────────────────────────
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    ensureSpace(50)
    sectionLabel(L.lineItems)

    const C_NUM  = MX + 4
    const C_PROD = MX + 20
    const C_QTY  = MX + col * 0.57
    const C_UOM  = MX + col * 0.64
    const C_UPR  = MX + col * 0.84
    const C_TR   = MX + col - 2
    const PROD_W = C_QTY - C_PROD - 6

    const HDR_ROW = 18
    ensureSpace(HDR_ROW + 2)
    text('#',          C_NUM,  y, 7.5, fontB, C.muted)
    text(L.product,    C_PROD, y, 7.5, fontB, C.muted)
    text(L.qty,        C_QTY,  y, 7.5, fontB, C.muted)
    text(L.uom,        C_UOM,  y, 7.5, fontB, C.muted)
    rText(L.unitPrice, C_UPR,  y, 7.5, fontB, C.muted)
    rText(L.total,     C_TR,   y, 7.5, fontB, C.muted)
    y -= 6
    rule(y)
    y -= HDR_ROW - 6

    for (let i = 0; i < items.length; i++) {
      const item         = items[i]
      const baseLine     = item.unit_price * item.quantity
      const itemAdjs     = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal    = calcLineTotal(item)
      const cfg          = Array.isArray(item.configuration) ? item.configuration : []
      const allFormulas  = Array.isArray(item.formulas) ? item.formulas : []
      const formulaSum   = allFormulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
      const formulas     = allFormulas.filter(f => (Number(f.amount) || 0) !== 0)
      const ptexts       = resolveProductTextBlocks(texts, item.product_id, lang)
      const modifierSum  = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
      const derivedBase  = item.unit_price - modifierSum - formulaSum
      const showBreakdown = (cfg.length > 0 || formulas.length > 0)
        && isSectionVisible(layoutSections, 'price-breakdown')
      const showDescriptions = showBreakdown
        && isSectionVisibleOptIn(layoutSections, 'characteristic-descriptions')
      const descLines: Record<string, string[]> = {}
      if (showDescriptions) {
        for (const c of cfg) {
          const desc = resolveCharDescription(c.characteristic_description_i18n, lang)
          if (desc) descLines[c.characteristic_id] = wrapText(desc, fontR, 7.5, PROD_W - 12)
        }
      }
      const descLineCount = Object.values(descLines).reduce((s, ls) => s + ls.length, 0)

      const nameLines = wrapText(item.product_name, fontB, 10, PROD_W)
      let rh = nameLines.length * 13
      if (item.product_sku)    rh += 11
      if (showBreakdown)       rh += 11 + (cfg.length + formulas.length) * 11 + descLineCount * 10
      for (const pt of ptexts) rh += 11 + wrapText(pt.content, fontR, 8, PROD_W - 4).length * 11
      if (itemAdjs.length > 0) rh += 4 + 11 + itemAdjs.length * 11
      rh += 14
      ensureSpace(rh)

      if (i % 2 === 1)
        page.drawRectangle({ x: MX, y: y - rh + 4, width: col, height: rh, color: C.rowAlt })

      const rowY = y

      text(`${i + 1}`, C_NUM, y, 8.5, fontR, C.faint)

      for (const line of nameLines) {
        text(line, C_PROD, y, 10, fontB, C.ink)
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
          const lines = descLines[c.characteristic_id]
          if (lines) {
            for (const line of lines) {
              text(line, C_PROD + 12, y, 7.5, fontR, C.faint)
              y -= 10
            }
          }
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
        text(`${pt.label ?? pt.slot}:`, C_PROD + 4, y, 7.5, fontB, C.muted)
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
      rText(lineTotal.toFixed(2),       C_TR,  rowY, 9.5, fontB, C.ink)

      y -= 8
      if (i < items.length - 1)
        page.drawLine({ start: { x: MX, y: y + 4 }, end: { x: MX + col, y: y + 4 }, thickness: 0.25, color: C.rule })
    }
    y -= 12
  }

  // ── Financial summary ─────────────────────────────────────────────────────
  rule(y)
  y -= 20

  const adjustments = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const SUM_W = 240
  const SUM_L = W - MX - SUM_W
  const SUM_R = W - MX

  text(L.subtotal, SUM_L, y, 9.5, fontR, C.muted)
  rText(`${quotation.subtotal.toFixed(2)} ${quotation.currency}`, SUM_R, y, 9.5, fontR, C.ink)
  y -= 17

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
    text(label, SUM_L, y, 9, fontR, C.muted)
    rText(amtStr, SUM_R, y, 9, fontB, applied >= 0 ? C.positive : C.negative)
    y -= 16
  }

  ensureSpace(32)
  rule(y, C.rule)
  y -= 18
  text(L.totalDue, SUM_L, y, 8.5, fontB, C.muted)
  rText(`${quotation.total_price.toFixed(2)} ${quotation.currency}`, SUM_R, y, 15, fontB, C.ink)
  y -= 28

  // ── Sections 6+: notes, terms, global text blocks ────────────────────────
  function drawNotesSection() {
    if (!quotation.notes) return
    const lines = wrapText(quotation.notes, fontR, 9.5, col)
    ensureSpace(36 + lines.length * 14)
    y -= 18
    rule(y)
    y -= 18
    sectionLabel(L.notes)
    for (const line of lines) {
      ensureSpace(14)
      text(line, MX, y, 9.5, fontR, C.ink)
      y -= 14
    }
    y -= 6
  }

  function drawTermsSection() {
    const boxLines = getTermsLines(texts, L.termsLines, lang)
    const BOX_H   = boxLines.length * 13 + 18
    ensureSpace(BOX_H + 40)
    y -= 18
    rule(y)
    y -= 18
    sectionLabel(L.termsHeader)
    page.drawRectangle({
      x: MX, y: y - BOX_H + 8, width: col, height: BOX_H,
      color: C.termsBox, borderColor: C.rule, borderWidth: 0.5,
    })
    for (const line of boxLines) {
      text(line, MX + 10, y, 8.5, fontR, C.ink)
      y -= 13
    }
    y -= 8
  }

  function drawGlobalTextSection(txt: ResolvedTextBlock) {
    const lines = wrapText(txt.content, fontR, 9.5, col)
    ensureSpace(36 + lines.length * 14)
    y -= 18
    rule(y)
    y -= 18
    sectionLabel((txt.label ?? txt.slot).toUpperCase())
    for (const line of lines) {
      ensureSpace(14)
      text(line, MX, y, 9.5, fontR, C.ink)
      y -= 14
    }
    y -= 6
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
    const lw    = fontR.widthOfTextAtSize(label, 7.5)
    pg.drawText(label, { x: W / 2 - lw / 2, y: MB - 14, size: 7.5, font: fontR, color: C.muted })
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
