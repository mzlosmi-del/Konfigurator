import ExcelJS from 'exceljs'
import type {
  Quotation, TenantText, QuotationLineItem, QuotationAdjustment, QuotationConfigItem,
} from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import {
  PDF_LABELS, type TenantProfile, getFooterLabel, getTermsLines, loadLogoBytes,
  isSectionVisible, isSectionVisibleOptIn, resolveCharDescription, buildOrderedSections,
} from './pdf/shared'
import { resolveProductTextBlocks, resolveTenantTextBlocks } from './texts'

type Labels = (typeof PDF_LABELS)[keyof typeof PDF_LABELS]

export interface BuildXlsxArgs {
  tenant:          TenantProfile
  quotation:       Quotation
  /** Pre-fetched `tenant_texts` rows scoped to the tenant + every product
   *  referenced by the quotation. */
  texts?:          TenantText[]
  layoutSections?: PdfSection[]
  lang:            'en' | 'sr'
}

const HEX = {
  ink:      'FF151928',
  muted:    'FF6C7179',
  faint:    'FFADB1B7',
  rowAlt:   'FFF7F8FB',
  termsBox: 'FFF4F5F7',
  rule:     'FFD2D4D8',
  accent:   'FF154BE4',
  positive: 'FF0C9563',
  negative: 'FFD22E2E',
  white:    'FFFFFFFF',
}

function fmtLongDate(iso: string | null | undefined, locale: 'en-GB' | 'sr-Latn-RS'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { dateStyle: 'long' })
}

const FONT = 'Noto Sans'

/** Single-sheet XLSX that mirrors the modern PDF layout. The sheet is built on
 *  a 12-column grid; column widths are tuned so the layout reads like an A4
 *  document at 100% zoom in Excel/LibreOffice. Each visual block is rendered
 *  by appending rows in order — no separate sheets, no pivoting. */
export async function buildQuotationXlsxBytes(args: BuildXlsxArgs): Promise<Uint8Array> {
  const { tenant, quotation, texts = [], layoutSections, lang } = args
  const tenantBlocks = resolveTenantTextBlocks(texts, lang)
  const L: Labels = PDF_LABELS[lang]
  const items = (Array.isArray(quotation.line_items)  ? quotation.line_items  : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const currency = quotation.currency ?? ''
  const showBreakdownGlobal = isSectionVisible(layoutSections, 'price-breakdown')
  const showDescriptions    = showBreakdownGlobal
    && isSectionVisibleOptIn(layoutSections, 'characteristic-descriptions')

  const logo = await loadLogoBytes(tenant.logo_url)

  const wb = new ExcelJS.Workbook()
  wb.creator = tenant.name
  wb.title   = quotation.reference_number ?? L.quotation
  wb.created = new Date()

  const ws = wb.addWorksheet(L.quotation, {
    pageSetup: {
      paperSize:        9, // A4
      orientation:      'portrait',
      fitToPage:        true,
      fitToWidth:       1,
      fitToHeight:      0,
      margins:          { left: 0.4, right: 0.4, top: 0.4, bottom: 0.6, header: 0.2, footer: 0.3 },
      printTitlesRow:   undefined,
    },
    views: [{ showGridLines: false }],
  })

  // ── 12-column grid — total width ≈ matches A4 portrait ────────────────────
  ws.columns = [
    { width: 4 },  // A: # number
    { width: 6 },  // B
    { width: 12 }, // C
    { width: 12 }, // D
    { width: 10 }, // E
    { width: 10 }, // F
    { width: 8 },  // G
    { width: 8 },  // H
    { width: 8 },  // I
    { width: 8 },  // J: unit price
    { width: 8 },  // K
    { width: 10 }, // L: total
  ]

  let row = 1
  const ruleBorder: Partial<ExcelJS.Borders> = {
    bottom: { style: 'thin', color: { argb: HEX.rule } },
  }
  const cellRefs = (r: number, fromCol: string, toCol: string) => `${fromCol}${r}:${toCol}${r}`

  /** Draw a horizontal rule across all 12 columns by setting the bottom border
   *  of the given row. */
  function rule(r: number) {
    for (let c = 1; c <= 12; c++) {
      ws.getCell(r, c).border = ruleBorder
    }
  }

  // ── Header: logo (cols A-E) + QUOTATION title (cols F-L) ────────────────
  const HEADER_ROWS = 5
  for (let i = 0; i < HEADER_ROWS; i++) ws.getRow(row + i).height = 18
  ws.mergeCells(`A${row}:E${row + HEADER_ROWS - 1}`)
  ws.mergeCells(`F${row}:L${row}`)
  ws.getCell(`F${row}`).value = L.quotation
  ws.getCell(`F${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`F${row}`).font = { name: FONT, bold: true, size: 22, color: { argb: HEX.ink } }
  ws.getRow(row).height = 32

  // Title / reference / dates stacked under the title (rows + 1 ... + 4)
  const metaLines: { txt: string; size: number; color: string; bold?: boolean }[] = []
  if (quotation.title)            metaLines.push({ txt: quotation.title, size: 9, color: HEX.muted })
  if (quotation.reference_number) metaLines.push({ txt: quotation.reference_number, size: 9, color: HEX.muted })
  metaLines.push({ txt: fmtLongDate(quotation.created_at, L.dateLocale), size: 8, color: HEX.faint })
  if (quotation.valid_until) {
    metaLines.push({
      txt:   `${L.validUntil}: ${fmtLongDate(quotation.valid_until, L.dateLocale)}`,
      size:  8, color: HEX.faint,
    })
  }
  metaLines.slice(0, HEADER_ROWS - 1).forEach((m, idx) => {
    const r = row + 1 + idx
    ws.mergeCells(`F${r}:L${r}`)
    const cell = ws.getCell(`F${r}`)
    cell.value     = m.txt
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    cell.font      = { name: FONT, bold: m.bold, size: m.size, color: { argb: m.color } }
  })

  // Embed the logo over the left header block (preserving aspect ratio).
  if (logo && logo.width > 0 && logo.height > 0) {
    // ExcelJS only handles png/gif/jpeg; map our wider set or fall back to png.
    const xlExt: 'png' | 'jpeg' | 'gif' =
      logo.extension === 'jpg' ? 'jpeg'
      : logo.extension === 'gif' ? 'gif'
      : logo.extension === 'bmp' ? 'png'  // bmp not supported — let Excel render the bytes as png-ish
      : 'png'
    const imgId = wb.addImage({ buffer: logo.bytes.buffer as ArrayBuffer, extension: xlExt })
    // Constrain to ~ 220×80px (≈ PDF 148×56pt at 1.5x for visibility).
    const maxW = 220, maxH = 80
    const ratio = Math.min(maxW / logo.width, maxH / logo.height, 1)
    ws.addImage(imgId, {
      tl: { col: 0.2, row: row - 1 + 0.2 },
      ext: { width: logo.width * ratio, height: logo.height * ratio },
      editAs: 'oneCell',
    })
  } else {
    // Fallback: tenant name in place of the logo
    const r = row
    ws.getCell(`A${r}`).value = tenant.name.toUpperCase()
    ws.getCell(`A${r}`).font  = { name: FONT, bold: true, size: 14, color: { argb: HEX.ink } }
    ws.getCell(`A${r}`).alignment = { horizontal: 'left', vertical: 'middle' }
  }

  row += HEADER_ROWS
  rule(row)
  row++

  // ── Sender strip ─────────────────────────────────────────────────────────
  ws.mergeCells(`A${row}:L${row}`)
  ws.getCell(`A${row}`).value = tenant.name.toUpperCase()
  ws.getCell(`A${row}`).font  = { name: FONT, bold: true, size: 11, color: { argb: HEX.ink } }
  row++

  const parts = [
    tenant.contact_person,
    tenant.company_address,
    tenant.company_phone,
    tenant.company_email,
    tenant.company_website,
  ].filter((v): v is string => !!v && v.trim().length > 0)
  if (parts.length > 0) {
    ws.mergeCells(`A${row}:L${row}`)
    ws.getCell(`A${row}`).value = parts.join('  ·  ')
    ws.getCell(`A${row}`).font  = { name: FONT, size: 9, color: { argb: HEX.muted } }
    ws.getCell(`A${row}`).alignment = { wrapText: true }
    row++
  }
  const regParts = [
    tenant.vat_number         ? `${L.vatNumber} ${tenant.vat_number}`         : null,
    tenant.company_reg_number ? `${L.regNumber} ${tenant.company_reg_number}` : null,
  ].filter((v): v is string => !!v)
  if (regParts.length > 0) {
    ws.mergeCells(`A${row}:L${row}`)
    ws.getCell(`A${row}`).value = regParts.join('   ')
    ws.getCell(`A${row}`).font  = { name: FONT, size: 9, color: { argb: HEX.faint } }
    row++
  }
  rule(row)
  row++

  // ── Bill To (cols A-F) + Quote Details (cols G-L) ─────────────────────────
  ws.mergeCells(`A${row}:F${row}`)
  ws.getCell(`A${row}`).value = L.billTo
  ws.getCell(`A${row}`).font  = { name: FONT, bold: true, size: 8, color: { argb: HEX.muted } }
  ws.mergeCells(`G${row}:L${row}`)
  ws.getCell(`G${row}`).value = L.quoteDetails
  ws.getCell(`G${row}`).font  = { name: FONT, bold: true, size: 8, color: { argb: HEX.muted } }
  row++

  const billStart = row
  const billLines: { txt: string; size: number; bold?: boolean; color: string }[] = []
  if (quotation.customer_name)    billLines.push({ txt: quotation.customer_name,    size: 13, bold: true, color: HEX.ink })
  if (quotation.customer_company) billLines.push({ txt: quotation.customer_company, size: 10, color: HEX.ink })
  if (quotation.customer_email)   billLines.push({ txt: quotation.customer_email,   size: 10, color: HEX.accent })
  if (quotation.customer_phone)   billLines.push({ txt: quotation.customer_phone,   size: 10, color: HEX.muted })
  if (quotation.customer_address) {
    for (const l of String(quotation.customer_address).split(/\r?\n/)) {
      if (l.trim()) billLines.push({ txt: l, size: 10, color: HEX.muted })
    }
  }
  if (quotation.customer_vat_number) billLines.push({
    txt: `${L.customerVat}: ${quotation.customer_vat_number}`, size: 9, color: HEX.faint,
  })
  if (quotation.delivery_address) {
    billLines.push({ txt: '', size: 4, color: HEX.muted })
    billLines.push({ txt: L.shipTo, size: 8, bold: true, color: HEX.muted })
    for (const l of String(quotation.delivery_address).split(/\r?\n/)) {
      if (l.trim()) billLines.push({ txt: l, size: 10, color: HEX.muted })
    }
  }

  const detailLines: { label: string; value: string }[] = []
  if (quotation.reference_number) detailLines.push({ label: L.reference,    value: quotation.reference_number })
  detailLines.push({ label: L.issued, value: fmtLongDate(quotation.created_at, L.dateLocale) })
  if (quotation.valid_until)   detailLines.push({ label: L.validUntil,   value: fmtLongDate(quotation.valid_until, L.dateLocale) })
  if (quotation.currency)      detailLines.push({ label: L.currency,     value: quotation.currency })
  if (tenant.contact_person)   detailLines.push({ label: L.preparedBy,   value: tenant.contact_person })
  if (quotation.payment_terms) detailLines.push({ label: L.paymentTerms, value: quotation.payment_terms })

  const blockRows = Math.max(billLines.length, detailLines.length)
  for (let i = 0; i < blockRows; i++) {
    const r = billStart + i
    if (i < billLines.length) {
      ws.mergeCells(`A${r}:F${r}`)
      const c = ws.getCell(`A${r}`)
      c.value     = billLines[i].txt
      c.font      = { name: FONT, bold: billLines[i].bold, size: billLines[i].size, color: { argb: billLines[i].color } }
      c.alignment = { vertical: 'top', wrapText: true }
    } else {
      ws.mergeCells(`A${r}:F${r}`)
    }
    if (i < detailLines.length) {
      // Label in cols G-I, value right-aligned in cols J-L
      ws.mergeCells(`G${r}:I${r}`)
      ws.mergeCells(`J${r}:L${r}`)
      const lc = ws.getCell(`G${r}`)
      lc.value     = detailLines[i].label
      lc.font      = { name: FONT, size: 9, color: { argb: HEX.muted } }
      lc.alignment = { vertical: 'top' }
      const vc = ws.getCell(`J${r}`)
      vc.value     = detailLines[i].value
      vc.font      = { name: FONT, bold: true, size: 9, color: { argb: HEX.ink } }
      vc.alignment = { horizontal: 'right', vertical: 'top' }
    } else {
      ws.mergeCells(`G${r}:L${r}`)
    }
    // Light vertical separator between bill and quote columns
    ws.getCell(`G${r}`).border = {
      ...ws.getCell(`G${r}`).border,
      left: { style: 'thin', color: { argb: HEX.rule } },
    }
  }
  row = billStart + blockRows
  rule(row)
  row++

  // ── Line items section ────────────────────────────────────────────────────
  ws.mergeCells(`A${row}:L${row}`)
  ws.getCell(`A${row}`).value = L.lineItems
  ws.getCell(`A${row}`).font  = { name: FONT, bold: true, size: 8, color: { argb: HEX.muted } }
  row++
  rule(row - 1)

  // Header row for the items table
  const headerStyle: Partial<ExcelJS.Style> = {
    font:      { name: FONT, bold: true, size: 8, color: { argb: HEX.muted } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.termsBox } },
  }
  const hdr = row
  ws.getCell(`A${hdr}`).value = '#'
  ws.mergeCells(`B${hdr}:G${hdr}`); ws.getCell(`B${hdr}`).value = L.product
  ws.getCell(`H${hdr}`).value = L.qty
  ws.getCell(`I${hdr}`).value = L.uom
  ws.mergeCells(`J${hdr}:K${hdr}`); ws.getCell(`J${hdr}`).value = L.unitPrice
  ws.getCell(`L${hdr}`).value = L.total
  for (const k of ['A','B','H','I','J','L']) {
    Object.assign(ws.getCell(`${k}${hdr}`), { font: headerStyle.font, fill: headerStyle.fill })
  }
  ws.getCell(`H${hdr}`).alignment = { horizontal: 'right' }
  ws.getCell(`J${hdr}`).alignment = { horizontal: 'right' }
  ws.getCell(`L${hdr}`).alignment = { horizontal: 'right' }
  rule(hdr)
  row++

  // ── Item rows ─────────────────────────────────────────────────────────────
  items.forEach((item, i) => {
    const cfg      = (Array.isArray(item.configuration) ? item.configuration : []) as QuotationConfigItem[]
    const formulas = (Array.isArray(item.formulas) ? item.formulas : []).filter(f => (Number(f.amount) || 0) !== 0)
    const itemAdjs = Array.isArray(item.adjustments) ? item.adjustments : []
    const ptexts   = resolveProductTextBlocks(texts, item.product_id, lang)
    const showBreakdown = showBreakdownGlobal && (cfg.length + formulas.length > 0)
    const modSum     = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
    const formulaSum = formulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
    const baseLine   = item.unit_price * item.quantity
    const derivedBase = item.unit_price - modSum - formulaSum
    const lineTotal  = baseLine
    const shade      = i % 2 === 1 ? HEX.rowAlt : undefined

    // Main item row
    const mainRow = row
    ws.getCell(`A${mainRow}`).value = i + 1
    ws.getCell(`A${mainRow}`).font  = { name: FONT, size: 9, color: { argb: HEX.faint } }
    ws.mergeCells(`B${mainRow}:G${mainRow}`)
    ws.getCell(`B${mainRow}`).value = item.product_name
    ws.getCell(`B${mainRow}`).font  = { name: FONT, bold: true, size: 11, color: { argb: HEX.ink } }
    ws.getCell(`B${mainRow}`).alignment = { vertical: 'top', wrapText: true }
    ws.getCell(`H${mainRow}`).value = item.quantity
    ws.getCell(`H${mainRow}`).font  = { name: FONT, size: 10, color: { argb: HEX.ink } }
    ws.getCell(`H${mainRow}`).alignment = { horizontal: 'right', vertical: 'top' }
    ws.getCell(`I${mainRow}`).value = item.unit_of_measure ?? '—'
    ws.getCell(`I${mainRow}`).font  = { name: FONT, size: 10, color: { argb: HEX.muted } }
    ws.getCell(`I${mainRow}`).alignment = { vertical: 'top' }
    ws.mergeCells(`J${mainRow}:K${mainRow}`)
    ws.getCell(`J${mainRow}`).value = Number(item.unit_price.toFixed(2))
    ws.getCell(`J${mainRow}`).numFmt = '#,##0.00'
    ws.getCell(`J${mainRow}`).font  = { name: FONT, size: 10, color: { argb: HEX.ink } }
    ws.getCell(`J${mainRow}`).alignment = { horizontal: 'right', vertical: 'top' }
    ws.getCell(`L${mainRow}`).value = Number(lineTotal.toFixed(2))
    ws.getCell(`L${mainRow}`).numFmt = '#,##0.00'
    ws.getCell(`L${mainRow}`).font  = { name: FONT, bold: true, size: 10, color: { argb: HEX.ink } }
    ws.getCell(`L${mainRow}`).alignment = { horizontal: 'right', vertical: 'top' }
    if (shade) {
      for (const k of ['A','B','H','I','J','L']) {
        ws.getCell(`${k}${mainRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
      }
    }
    row++

    // SKU sub-row
    if (item.product_sku) {
      ws.mergeCells(`B${row}:G${row}`)
      ws.getCell(`B${row}`).value = `SKU: ${item.product_sku}`
      ws.getCell(`B${row}`).font  = { name: FONT, size: 8, color: { argb: HEX.muted } }
      if (shade) for (const k of ['A','B','H','I','J','L']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
      row++
    }

    // Breakdown lines (base price, characteristic modifiers, formulas)
    if (showBreakdown) {
      // base price
      ws.mergeCells(`B${row}:K${row}`)
      ws.getCell(`B${row}`).value = L.basePrice
      ws.getCell(`B${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
      ws.getCell(`B${row}`).alignment = { indent: 1 }
      ws.getCell(`L${row}`).value = Number(derivedBase.toFixed(2))
      ws.getCell(`L${row}`).numFmt = '#,##0.00'
      ws.getCell(`L${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
      ws.getCell(`L${row}`).alignment = { horizontal: 'right' }
      if (shade) for (const k of ['A','B','L']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
      row++

      for (const c of cfg) {
        const mod = Number(c.price_modifier) || 0
        const modColor = mod > 0 ? HEX.positive : mod < 0 ? HEX.negative : HEX.muted
        ws.mergeCells(`B${row}:K${row}`)
        ws.getCell(`B${row}`).value = c.value_label ? `+ ${c.characteristic_name}: ${c.value_label}` : `+ ${c.characteristic_name}`
        ws.getCell(`B${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
        ws.getCell(`B${row}`).alignment = { indent: 1 }
        ws.getCell(`L${row}`).value = mod === 0 ? '—' : Number(mod.toFixed(2))
        if (mod !== 0) ws.getCell(`L${row}`).numFmt = mod > 0 ? '"+"#,##0.00' : '#,##0.00'
        ws.getCell(`L${row}`).font  = { name: FONT, size: 8.5, color: { argb: modColor } }
        ws.getCell(`L${row}`).alignment = { horizontal: 'right' }
        if (shade) for (const k of ['A','B','L']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
        row++

        if (showDescriptions) {
          const desc = resolveCharDescription(c.characteristic_description_i18n, lang)
          if (desc) {
            for (const line of desc.split(/\r?\n/)) {
              if (!line.trim()) continue
              ws.mergeCells(`B${row}:L${row}`)
              ws.getCell(`B${row}`).value = line
              ws.getCell(`B${row}`).font  = { name: FONT, size: 8, italic: true, color: { argb: HEX.faint } }
              ws.getCell(`B${row}`).alignment = { indent: 2, wrapText: true }
              if (shade) for (const k of ['A','B']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
              row++
            }
          }
        }
      }
      for (const f of formulas) {
        const amt = Number(f.amount) || 0
        const amtColor = amt > 0 ? HEX.positive : amt < 0 ? HEX.negative : HEX.muted
        ws.mergeCells(`B${row}:K${row}`)
        ws.getCell(`B${row}`).value = `ƒ ${f.formula_name}`
        ws.getCell(`B${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
        ws.getCell(`B${row}`).alignment = { indent: 1 }
        ws.getCell(`L${row}`).value = Number(amt.toFixed(2))
        ws.getCell(`L${row}`).numFmt = amt > 0 ? '"+"#,##0.00' : '#,##0.00'
        ws.getCell(`L${row}`).font  = { name: FONT, size: 8.5, color: { argb: amtColor } }
        ws.getCell(`L${row}`).alignment = { horizontal: 'right' }
        if (shade) for (const k of ['A','B','L']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
        row++
      }
    }

    // Product text blocks
    for (const pt of ptexts) {
      ws.mergeCells(`B${row}:L${row}`)
      ws.getCell(`B${row}`).value = `${pt.label ?? pt.slot}:`
      ws.getCell(`B${row}`).font  = { name: FONT, bold: true, size: 8, color: { argb: HEX.muted } }
      ws.getCell(`B${row}`).alignment = { indent: 1 }
      if (shade) for (const k of ['A','B']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
      row++
      for (const line of String(pt.content).split(/\r?\n/)) {
        if (!line.trim()) continue
        ws.mergeCells(`B${row}:L${row}`)
        ws.getCell(`B${row}`).value = line
        ws.getCell(`B${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
        ws.getCell(`B${row}`).alignment = { indent: 2, wrapText: true }
        if (shade) for (const k of ['A','B']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
        row++
      }
    }

    // Per-item adjustments
    if (itemAdjs.length > 0) {
      ws.mergeCells(`B${row}:K${row}`)
      ws.getCell(`B${row}`).value = L.subtotal
      ws.getCell(`B${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
      ws.getCell(`B${row}`).alignment = { indent: 1 }
      ws.getCell(`L${row}`).value = Number(baseLine.toFixed(2))
      ws.getCell(`L${row}`).numFmt = '#,##0.00'
      ws.getCell(`L${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
      ws.getCell(`L${row}`).alignment = { horizontal: 'right' }
      if (shade) for (const k of ['A','B','L']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
      row++

      let runItem = baseLine
      for (const adj of itemAdjs) {
        const amt     = adj.mode === 'percent' ? (runItem * adj.value) / 100 : adj.value
        const applied = adj.type === 'discount' ? -amt : amt
        runItem += applied
        const lbl = `${adj.label || adj.type}${adj.mode === 'percent' ? ` (${adj.value}%)` : ''}`
        ws.mergeCells(`B${row}:K${row}`)
        ws.getCell(`B${row}`).value = lbl
        ws.getCell(`B${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
        ws.getCell(`B${row}`).alignment = { indent: 1 }
        ws.getCell(`L${row}`).value = Number(applied.toFixed(2))
        ws.getCell(`L${row}`).numFmt = applied >= 0 ? '"+"#,##0.00' : '#,##0.00'
        ws.getCell(`L${row}`).font  = { name: FONT, size: 8.5, color: { argb: applied >= 0 ? HEX.positive : HEX.negative } }
        ws.getCell(`L${row}`).alignment = { horizontal: 'right' }
        if (shade) for (const k of ['A','B','L']) ws.getCell(`${k}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
        row++
      }
    }

    // Thin separator between items
    if (i < items.length - 1) {
      for (let c = 1; c <= 12; c++) {
        ws.getCell(row, c).border = { bottom: { style: 'hair', color: { argb: HEX.rule } } }
      }
      row++
    }
  })

  // ── Financial summary (right-aligned) ─────────────────────────────────────
  rule(row)
  row++
  const sumStart = row

  const writeSummary = (label: string, value: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => {
    ws.mergeCells(`A${row}:H${row}`)
    ws.mergeCells(`I${row}:J${row}`)
    ws.mergeCells(`K${row}:L${row}`)
    const lc = ws.getCell(`I${row}`)
    lc.value     = label
    lc.font      = { name: FONT, bold: opts.bold, size: opts.size ?? 10, color: { argb: opts.color ?? HEX.muted } }
    lc.alignment = { horizontal: 'right' }
    const vc = ws.getCell(`K${row}`)
    vc.value     = value
    vc.font      = { name: FONT, bold: opts.bold, size: opts.size ?? 10, color: { argb: opts.color ?? HEX.ink } }
    vc.alignment = { horizontal: 'right' }
    row++
  }

  writeSummary(L.subtotal, `${quotation.subtotal.toFixed(2)} ${currency}`)
  let running = quotation.subtotal
  for (const adj of adjs) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    running += applied
    const pct = adj.mode === 'percent' ? ` ${adj.value}%` : ''
    writeSummary(
      `${adj.label}${pct}`,
      `${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${currency}`,
      { bold: true, color: applied >= 0 ? HEX.positive : HEX.negative },
    )
  }

  // Rule then total
  rule(row)
  row++
  writeSummary(L.totalDue, `${quotation.total_price.toFixed(2)} ${currency}`,
    { bold: true, size: 14, color: HEX.ink })
  void sumStart
  row++

  // ── Sections: notes, terms, global texts (in dialog order) ────────────────
  const writeBlockHeading = (label: string) => {
    rule(row)
    row++
    ws.mergeCells(`A${row}:L${row}`)
    ws.getCell(`A${row}`).value = label
    ws.getCell(`A${row}`).font  = { name: FONT, bold: true, size: 8, color: { argb: HEX.muted } }
    row++
    rule(row - 1)
  }

  const writeBlockBody = (lines: string[], opts: { boxed?: boolean } = {}) => {
    for (const line of lines) {
      ws.mergeCells(`A${row}:L${row}`)
      const c = ws.getCell(`A${row}`)
      c.value     = line
      c.font      = { name: FONT, size: 9.5, color: { argb: HEX.ink } }
      c.alignment = { wrapText: true, vertical: 'top', indent: opts.boxed ? 1 : 0 }
      if (opts.boxed) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX.termsBox } }
      row++
    }
  }

  const orderedSections = buildOrderedSections(layoutSections, tenantBlocks, lang)
  for (const section of orderedSections) {
    if (!section.visible) continue
    if (section.id === 'notes') {
      if (!quotation.notes || !isSectionVisible(layoutSections, 'notes')) continue
      writeBlockHeading(L.notes)
      writeBlockBody(String(quotation.notes).split(/\r?\n/).filter(l => l.trim()))
    } else if (section.id === 'terms') {
      if (!isSectionVisible(layoutSections, 'terms')) continue
      writeBlockHeading(L.termsHeader)
      writeBlockBody([...getTermsLines(texts, L.termsLines, lang)], { boxed: true })
    } else if (section.textId) {
      const gt = tenantBlocks.find(b => b.id === section.textId)
      if (!gt) continue
      writeBlockHeading((gt.label ?? gt.slot).toUpperCase())
      writeBlockBody(String(gt.content).split(/\r?\n/).filter(l => l.trim()))
    }
  }

  // ── Footer (validity left, footer label right) ────────────────────────────
  row += 1
  rule(row)
  row++
  const validStr = quotation.valid_until
    ? L.validityText(fmtLongDate(quotation.valid_until, L.dateLocale))
    : L.contactText
  ws.mergeCells(`A${row}:F${row}`)
  ws.getCell(`A${row}`).value = validStr
  ws.getCell(`A${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.muted } }
  ws.mergeCells(`G${row}:L${row}`)
  ws.getCell(`G${row}`).value = getFooterLabel(tenant, L.footer, texts, lang)
  ws.getCell(`G${row}`).font  = { name: FONT, size: 8.5, color: { argb: HEX.faint } }
  ws.getCell(`G${row}`).alignment = { horizontal: 'right' }
  void cellRefs

  // Page footer with page numbers (printed only)
  ws.headerFooter.oddFooter = `&L&"${FONT}"&8&K6C7179${validStr.replace(/&/g, '&&')}&C&"${FONT}"&8&K6C7179${L.page} &P ${L.of} &N&R&"${FONT}"&8&KADB1B7${getFooterLabel(tenant, L.footer, texts, lang).replace(/&/g, '&&')}`

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

export function openXlsxBlob(bytes: Uint8Array, filename = 'quotation.xlsx') {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
