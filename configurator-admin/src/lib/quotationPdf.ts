import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import type { Quotation, QuotationLineItem, QuotationAdjustment, ProductText } from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import { calcLineTotal } from '@/lib/quotations'

export interface TenantProfile {
  name:                string
  logo_url?:           string | null
  company_address?:    string | null
  company_phone?:      string | null
  company_email?:      string | null
  company_website?:    string | null
  contact_person?:     string | null
  vat_number?:         string | null
  company_reg_number?: string | null
}

// ── Palette ────────────────────────────────────────────────────────────────────
// Minimal light palette — no filled colour surfaces.
const C = {
  ink:      rgb(0.082, 0.098, 0.141),   // #151928  body text
  muted:    rgb(0.424, 0.443, 0.490),   // #6C7179  secondary labels
  faint:    rgb(0.678, 0.694, 0.718),   // #ADB1B7  captions / tertiary
  rowAlt:   rgb(0.969, 0.973, 0.984),   // #F7F8FB  very subtle alternating row
  termsBox: rgb(0.957, 0.961, 0.969),   // #F4F5F7  terms background
  rule:     rgb(0.824, 0.831, 0.847),   // #D2D4D8  divider lines
  accent:   rgb(0.082, 0.298, 0.894),   // #154BE4  email links
  positive: rgb(0.047, 0.584, 0.388),   // #0C9563  green amounts
  negative: rgb(0.824, 0.180, 0.180),   // #D22E2E  red amounts
}

// ── Text wrap ──────────────────────────────────────────────────────────────────
function wrapText(rawText: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = []
  for (const paragraph of rawText.split(/\r?\n/)) {
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) result.push(line)
        line = word
      } else {
        line = test
      }
    }
    result.push(line)
  }
  return result.length ? result : ['']
}

// ── PDF label translations ────────────────────────────────────────────────────

const PDF_LABELS = {
  en: {
    quotation:    'QUOTATION',
    billTo:       'BILL TO',
    shipTo:       'SHIP TO',
    quoteDetails: 'QUOTE DETAILS',
    reference:    'Reference',
    issued:       'Issue Date',
    validUntil:   'Valid Until',
    currency:     'Currency',
    preparedBy:   'Prepared By',
    paymentTerms: 'Payment Terms',
    vatNumber:    'VAT No.',
    regNumber:    'Reg. No.',
    customerVat:  'VAT / Tax ID',
    lineItems:    'LINE ITEMS',
    product:      'PRODUCT',
    qty:          'QTY',
    uom:          'UOM',
    unitPrice:    'UNIT PRICE',
    total:        'TOTAL',
    basePrice:    'Base price',
    subtotal:     'Subtotal',
    totalDue:     'TOTAL DUE',
    notes:        'NOTES',
    termsHeader:  'TERMS & CONDITIONS',
    termsLines: [
      '• Payment: 50% deposit on order confirmation, balance prior to delivery.',
      '• Prices are exclusive of VAT and applicable taxes unless otherwise stated.',
      '• This quotation is valid for 30 days unless a specific validity date is noted above.',
      '• Delivery timelines will be confirmed upon order placement.',
      '• Thank you for your business. We look forward to working with you.',
    ],
    validityText: (date: string) => `Valid until ${date}`,
    contactText:  'Contact us to confirm your order.',
    footer:       'Konfigurator',
    page:         'Page',
    of:           'of',
    dateLocale:   'en-GB' as const,
  },
  sr: {
    quotation:    'PONUDA',
    billTo:       'NARUČILAC',
    shipTo:       'ADRESA ISPORUKE',
    quoteDetails: 'DETALJI PONUDE',
    reference:    'Referenca',
    issued:       'Datum',
    validUntil:   'Važi do',
    currency:     'Valuta',
    preparedBy:   'Izradio',
    paymentTerms: 'Uslovi plaćanja',
    vatNumber:    'PDV br.',
    regNumber:    'Mat. br.',
    customerVat:  'PIB / PDV br.',
    lineItems:    'STAVKE',
    product:      'PROIZVOD',
    qty:          'KOL.',
    uom:          'JM',
    unitPrice:    'JED. CENA',
    total:        'UKUPNO',
    basePrice:    'Osnovna cena',
    subtotal:     'Međuzbir',
    totalDue:     'UKUPAN IZNOS',
    notes:        'NAPOMENE',
    termsHeader:  'USLOVI I PLAĆANJE',
    termsLines: [
      '• Plaćanje: 50% avans pri potvrdi porudžbine, ostatak pre isporuke.',
      '• Cene ne uključuju PDV i poreze, osim ako nije drugačije naznačeno.',
      '• Ova ponuda važi 30 dana, osim ako je naznačen konkretan datum.',
      '• Rokovi isporuke biće potvrđeni pri porudžbini.',
      '• Hvala na interesovanju. Radujemo se saradnji.',
    ],
    validityText: (date: string) => `Važi do ${date}`,
    contactText:  'Kontaktirajte nas radi potvrde porudžbine.',
    footer:       'Konfigurator',
    page:         'Strana',
    of:           'od',
    dateLocale:   'sr-Latn-RS' as const,
  },
}

// ── PDF builder ───────────────────────────────────────────────────────────────

export async function buildQuotationPdfBytes(
  tenant: TenantProfile,
  quotation: Quotation,
  productTexts?: Record<string, ProductText[]>,
  globalTexts?: ProductText[],
  layoutSections?: PdfSection[],
  lang: 'en' | 'sr' = 'en',
): Promise<Uint8Array> {
  const L = PDF_LABELS[lang]
  const pdfDoc = await PDFDocument.create()
  const fontR  = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // ── Page geometry ──────────────────────────────────────────────────────────
  const W = 595, H = 842
  const MX = 48          // horizontal margin
  const MB = 52          // bottom margin (footer space)
  const col = W - MX * 2

  // ── Page management ────────────────────────────────────────────────────────
  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0  // set explicitly before each section

  function newPage() {
    drawFooter()
    page = pdfDoc.addPage([W, H])
    // Minimal continuation header: company · reference in muted, then a rule
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

  // ── Drawing primitives ─────────────────────────────────────────────────────
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

  // Small all-caps section label followed by a thin rule
  function sectionLabel(label: string) {
    text(label, MX, y, 7, fontB, C.muted)
    y -= 5
    rule(y)
    y -= 14
  }

  // ── Footer (drawn at end of each page; page numbers added in second pass) ──
  function drawFooter() {
    const fy = MB - 14
    rule(fy + 12)
    const validStr = quotation.valid_until
      ? L.validityText(new Date(quotation.valid_until).toLocaleDateString(L.dateLocale, { dateStyle: 'long' }))
      : L.contactText
    text(validStr, MX, fy, 7.5, fontR, C.muted)
    rText(L.footer, W - MX, fy, 7.5, fontR, C.faint)
    // Page numbers are written in the second pass once total count is known
  }

  // ── Fetch logo (async, before drawing begins) ──────────────────────────────
  type EmbeddedImage = Awaited<ReturnType<typeof pdfDoc.embedPng>>
  let logoImg: EmbeddedImage | null = null
  if (tenant.logo_url) {
    try {
      const res = await fetch(tenant.logo_url)
      if (res.ok) {
        const ct  = res.headers.get('content-type') ?? ''
        const buf = await res.arrayBuffer()
        logoImg = ct.includes('png') || tenant.logo_url.toLowerCase().includes('.png')
          ? await pdfDoc.embedPng(buf)
          : await pdfDoc.embedJpg(buf)
      }
    } catch { /* fall through to text fallback */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Header: logo left, document type right, rule below
  // ══════════════════════════════════════════════════════════════════════════
  const HDR_TOP = H - 36          // top of usable header area (36pt top margin)
  const LOGO_W  = 148, LOGO_H = 56

  if (logoImg) {
    const dims = logoImg.scaleToFit(LOGO_W, LOGO_H)
    page.drawImage(logoImg, {
      x: MX,
      y: HDR_TOP - dims.height + 4,  // top-align within logo area
      width: dims.width, height: dims.height,
    })
  } else {
    // Company name as text fallback, large and bold
    const nameLines = wrapText(tenant.name.toUpperCase(), fontB, 13, LOGO_W)
    let ty = HDR_TOP
    for (const line of nameLines) {
      text(line, MX, ty, 13, fontB, C.ink)
      ty -= 17
    }
  }

  // Document type — right side
  const issueDate = new Date(quotation.created_at).toLocaleDateString(L.dateLocale, { dateStyle: 'long' })
  rText(L.quotation, W - MX, HDR_TOP, 22, fontB, C.ink)

  // Meta: title (if set), reference, dates — right-aligned below document type
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

  // Rule separating header from body
  y = HDR_TOP - LOGO_H - 10
  rule(y)
  y -= 28

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Sender strip (company name + contact info)
  // ══════════════════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Bill To (left) + Quote Details (right)
  // ══════════════════════════════════════════════════════════════════════════
  const half    = (col - 32) / 2
  const LX      = MX
  const RX      = MX + half + 32
  const secTopY = y

  // ─── Left: BILL TO ────────────────────────────────────────────────────────
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

  // ─── Right: QUOTE DETAILS ─────────────────────────────────────────────────
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

  // Vertical hairline between the two columns
  const secBotY = Math.min(y, ry) - 8
  page.drawLine({
    start: { x: MX + half + 16, y: secTopY + 4 },
    end:   { x: MX + half + 16, y: secBotY },
    thickness: 0.5, color: C.rule,
  })

  y = secBotY - 18
  rule(y)
  y -= 26

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Line items table
  // ══════════════════════════════════════════════════════════════════════════
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  if (items.length > 0) {
    ensureSpace(50)
    sectionLabel(L.lineItems)

    // Column positions
    const C_NUM  = MX + 4
    const C_PROD = MX + 20
    const C_QTY  = MX + col * 0.57
    const C_UOM  = MX + col * 0.64
    const C_UPR  = MX + col * 0.84
    const C_TR   = MX + col - 2
    const PROD_W = C_QTY - C_PROD - 6

    // Table column headers — plain text with a bottom rule, no fill
    const HDR_ROW = 18
    ensureSpace(HDR_ROW + 2)
    text('#',          C_NUM,  y, 7.5, fontB, C.muted)
    text(L.product,    C_PROD, y, 7.5, fontB, C.muted)
    text(L.qty,        C_QTY,  y, 7.5, fontB, C.muted)
    text(L.uom,        C_UOM,  y, 7.5, fontB, C.muted)
    rText(L.unitPrice, C_UPR,  y, 7.5, fontB, C.muted)
    rText(L.total,     C_TR,   y, 7.5, fontB, C.muted)
    y -= 6
    rule(y)    // thin rule below column headers
    y -= HDR_ROW - 6

    for (let i = 0; i < items.length; i++) {
      const item         = items[i]
      const baseLine     = item.unit_price * item.quantity
      const itemAdjs     = Array.isArray(item.adjustments) ? item.adjustments : []
      const lineTotal    = calcLineTotal(item)
      const cfg          = Array.isArray(item.configuration) ? item.configuration : []
      const ptexts       = (productTexts?.[item.product_id] ?? []).filter(pt => pt.language === lang)
      const modifierSum  = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
      const derivedBase  = item.unit_price - modifierSum
      const showBreakdown = cfg.length > 0

      // Compute row height for ensureSpace / page-break
      const nameLines = wrapText(item.product_name, fontB, 10, PROD_W)
      let rh = nameLines.length * 13
      if (item.product_sku)    rh += 11
      if (showBreakdown)       rh += 11 + cfg.length * 11
      for (const pt of ptexts) rh += 11 + wrapText(pt.content, fontR, 8, PROD_W - 4).length * 11
      if (itemAdjs.length > 0) rh += 4 + 11 + itemAdjs.length * 11
      rh += 14
      ensureSpace(rh)

      // Very subtle alternating row tint
      if (i % 2 === 1)
        page.drawRectangle({ x: MX, y: y - rh + 4, width: col, height: rh, color: C.rowAlt })

      const rowY = y

      // Row number
      text(`${i + 1}`, C_NUM, y, 8.5, fontR, C.faint)

      // Product name (wrapping)
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
        }
      }

      for (const pt of ptexts) {
        text(`${pt.label}:`, C_PROD + 4, y, 7.5, fontB, C.muted)
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

      // Right-side numerics always anchored to the first row y of this item
      text(String(item.quantity),       C_QTY, rowY, 9.5, fontR, C.ink)
      text(item.unit_of_measure ?? '—', C_UOM, rowY, 9.5, fontR, C.muted)
      rText(item.unit_price.toFixed(2), C_UPR, rowY, 9.5, fontR, C.ink)
      rText(lineTotal.toFixed(2),       C_TR,  rowY, 9.5, fontB, C.ink)

      y -= 8
      // Hairline between rows (not after last)
      if (i < items.length - 1)
        page.drawLine({ start: { x: MX, y: y + 4 }, end: { x: MX + col, y: y + 4 }, thickness: 0.25, color: C.rule })
    }
    y -= 10
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Financial summary
  // ══════════════════════════════════════════════════════════════════════════
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

  // TOTAL DUE — no filled box; just a thick rule above and bold large text
  ensureSpace(32)
  rule(y, C.rule)
  y -= 18
  text(L.totalDue, SUM_L, y, 8.5, fontB, C.muted)
  rText(`${quotation.total_price.toFixed(2)} ${quotation.currency}`, SUM_R, y, 15, fontB, C.ink)
  y -= 28

  // ── Sections 6+: notes, terms, global text blocks ────────────────────────

  function isSectionVisible(id: string): boolean {
    if (!layoutSections) return true
    const s = layoutSections.find(s => s.id === id)
    return s ? s.visible : true
  }

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
    const boxLines = L.termsLines
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

  function drawGlobalTextSection(txt: ProductText) {
    const lines = wrapText(txt.content, fontR, 9.5, col)
    ensureSpace(36 + lines.length * 14)
    y -= 18
    rule(y)
    y -= 18
    sectionLabel(txt.label.toUpperCase())
    for (const line of lines) {
      ensureSpace(14)
      text(line, MX, y, 9.5, fontR, C.ink)
      y -= 14
    }
    y -= 6
  }

  const defaultOrder: PdfSection[] = [
    { id: 'notes', label: 'Notes', visible: true },
    { id: 'terms', label: 'Terms & Conditions', visible: true },
    ...(globalTexts ?? []).filter(gt => gt.language === lang).map(gt => ({
      id: `text-${gt.id}`, label: gt.label, visible: true, textId: gt.id,
    })),
  ]
  const orderedSections = layoutSections ? layoutSections.filter(s => !s.locked) : defaultOrder

  for (const section of orderedSections) {
    if (!section.visible) continue
    if (section.id === 'notes') {
      if (isSectionVisible('notes')) drawNotesSection()
    } else if (section.id === 'terms') {
      if (isSectionVisible('terms')) drawTermsSection()
    } else if (section.textId) {
      const gt = (globalTexts ?? []).find(t => t.id === section.textId && t.language === lang)
      if (gt) drawGlobalTextSection(gt)
    }
  }

  // ── Footer on last page ────────────────────────────────────────────────────
  drawFooter()

  // ── Second pass: add "Page X of N" centred in every footer ───────────────
  const pages = pdfDoc.getPages()
  const N     = pages.length
  for (let i = 0; i < N; i++) {
    const pg    = pages[i]
    const label = `${L.page} ${i + 1} ${L.of} ${N}`
    const lw    = fontR.widthOfTextAtSize(label, 7.5)
    pg.drawText(label, { x: W / 2 - lw / 2, y: MB - 14, size: 7.5, font: fontR, color: C.muted })
  }

  return pdfDoc.save()
}

export function openPdfBlob(bytes: Uint8Array) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
}
