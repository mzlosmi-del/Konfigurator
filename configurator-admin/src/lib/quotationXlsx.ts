import ExcelJS from 'exceljs'
import type {
  Quotation, ProductText, QuotationLineItem, QuotationAdjustment, QuotationConfigItem,
} from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import {
  PDF_LABELS, type TenantProfile,
  isSectionVisible, isSectionVisibleOptIn, resolveCharDescription,
} from './pdf/shared'
import { calcLineTotal, calcSubtotal, calcTotal } from './quotations'

export interface BuildXlsxArgs {
  tenant:          TenantProfile
  quotation:       Quotation
  productTexts?:   Record<string, ProductText[]>
  globalTexts?:    ProductText[]
  layoutSections?: PdfSection[]
  lang:            'en' | 'sr'
}

function fmtDate(iso: string | null | undefined, locale: 'en-GB' | 'sr-Latn-RS'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale)
}

/** Build an XLSX workbook with three sheets:
 *  1. Summary — header info, totals.
 *  2. Line Items — one row per item with full config breakdown.
 *  3. Configuration Detail — one row per (line item, characteristic) including the
 *     translated description (when the matching section is enabled).
 *  Notes / terms are appended to the Summary sheet so the file is self-contained. */
export async function buildQuotationXlsxBytes(args: BuildXlsxArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang } = args
  const L = PDF_LABELS[lang]
  const items = (Array.isArray(quotation.line_items)  ? quotation.line_items  : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const currency = quotation.currency ?? ''
  const showDescriptions = isSectionVisibleOptIn(layoutSections, 'characteristic-descriptions')
  const showBreakdown    = isSectionVisible(layoutSections, 'price-breakdown')

  const wb = new ExcelJS.Workbook()
  wb.creator     = tenant.name
  wb.title       = quotation.reference_number ?? L.quotation
  wb.created     = new Date()

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const summary = wb.addWorksheet(lang === 'en' ? 'Summary' : 'Pregled')
  summary.columns = [
    { width: 28 }, { width: 50 },
  ]

  const label = (row: number, k: string, v: string) => {
    summary.getCell(`A${row}`).value = k
    summary.getCell(`A${row}`).font  = { bold: true, color: { argb: 'FF6C7179' } }
    summary.getCell(`B${row}`).value = v
  }

  summary.mergeCells('A1:B1')
  summary.getCell('A1').value = L.quotation
  summary.getCell('A1').font  = { bold: true, size: 18, color: { argb: 'FF151928' } }

  let r = 3
  label(r++, lang === 'en' ? 'From' : 'Pošiljalac', tenant.name)
  if (tenant.company_address) label(r++, lang === 'en' ? 'Address' : 'Adresa', tenant.company_address)
  if (tenant.company_email)   label(r++, 'Email', tenant.company_email)
  if (tenant.company_phone)   label(r++, lang === 'en' ? 'Phone' : 'Telefon', tenant.company_phone)
  if (tenant.vat_number)      label(r++, L.vatNumber, tenant.vat_number)
  r++

  label(r++, L.billTo, '')
  if (quotation.customer_name)    label(r++, lang === 'en' ? 'Name' : 'Ime', quotation.customer_name)
  if (quotation.customer_company) label(r++, lang === 'en' ? 'Company' : 'Firma', quotation.customer_company)
  if (quotation.customer_email)   label(r++, 'Email', quotation.customer_email)
  if (quotation.customer_phone)   label(r++, lang === 'en' ? 'Phone' : 'Telefon', quotation.customer_phone)
  if (quotation.customer_address) label(r++, lang === 'en' ? 'Address' : 'Adresa', quotation.customer_address)
  r++

  if (quotation.reference_number) label(r++, L.reference, quotation.reference_number)
  label(r++, L.issued, fmtDate(quotation.created_at, L.dateLocale))
  if (quotation.valid_until) label(r++, L.validUntil, fmtDate(quotation.valid_until, L.dateLocale))
  label(r++, L.currency, currency)
  const paymentTerms = (quotation as { payment_terms?: string | null }).payment_terms
  if (paymentTerms) label(r++, L.paymentTerms, paymentTerms)
  r++

  // Totals
  const subtotal = calcSubtotal(items)
  const total    = calcTotal(subtotal, adjs)
  label(r++, L.subtotal, `${subtotal.toFixed(2)} ${currency}`)
  let running = subtotal
  for (const a of adjs) {
    const amount  = a.mode === 'percent' ? (running * a.value) / 100 : a.value
    const applied = a.type === 'discount' ? -amount : amount
    label(r++, a.label, `${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${currency}`)
    running += applied
  }
  const totalRow = r
  label(r++, L.totalDue, `${total.toFixed(2)} ${currency}`)
  summary.getCell(`A${totalRow}`).font = { bold: true, size: 12, color: { argb: 'FF151928' } }
  summary.getCell(`B${totalRow}`).font = { bold: true, size: 12, color: { argb: 'FF151928' } }
  r++

  // Notes
  if (quotation.notes && isSectionVisible(layoutSections, 'notes')) {
    summary.mergeCells(`A${r}:B${r}`)
    summary.getCell(`A${r}`).value = L.notes
    summary.getCell(`A${r}`).font  = { bold: true, color: { argb: 'FF6C7179' } }
    r++
    summary.mergeCells(`A${r}:B${r}`)
    summary.getCell(`A${r}`).value = String(quotation.notes)
    summary.getCell(`A${r}`).alignment = { wrapText: true, vertical: 'top' }
    summary.getRow(r).height = 60
    r++
  }

  // Terms
  if (isSectionVisible(layoutSections, 'terms')) {
    summary.mergeCells(`A${r}:B${r}`)
    summary.getCell(`A${r}`).value = L.termsHeader
    summary.getCell(`A${r}`).font  = { bold: true, color: { argb: 'FF6C7179' } }
    r++
    for (const t of L.termsLines) {
      summary.mergeCells(`A${r}:B${r}`)
      summary.getCell(`A${r}`).value = t
      r++
    }
    r++
  }

  // Global text blocks (visible only)
  for (const gt of (globalTexts ?? []).filter(g => g.language === lang)) {
    if (!isSectionVisible(layoutSections, `text-${gt.id}`)) continue
    summary.mergeCells(`A${r}:B${r}`)
    summary.getCell(`A${r}`).value = gt.label
    summary.getCell(`A${r}`).font  = { bold: true, color: { argb: 'FF6C7179' } }
    r++
    summary.mergeCells(`A${r}:B${r}`)
    summary.getCell(`A${r}`).value = gt.content
    summary.getCell(`A${r}`).alignment = { wrapText: true, vertical: 'top' }
    summary.getRow(r).height = 60
    r++
  }

  // ── Line Items sheet ──────────────────────────────────────────────────────
  const sheet = wb.addWorksheet(lang === 'en' ? 'Line Items' : 'Stavke')
  sheet.columns = [
    { header: '#',           key: 'idx',       width: 5  },
    { header: L.product,     key: 'product',   width: 36 },
    { header: 'SKU',         key: 'sku',       width: 16 },
    { header: L.qty,         key: 'qty',       width: 8  },
    { header: L.unitPrice,   key: 'unitPrice', width: 14 },
    { header: L.total,       key: 'total',     width: 14 },
  ]
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF6C7179' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  items.forEach((item, i) => {
    sheet.addRow({
      idx:       i + 1,
      product:   item.product_name,
      sku:       item.product_sku ?? '',
      qty:       item.quantity,
      unitPrice: Number(item.unit_price.toFixed(2)),
      total:     Number(calcLineTotal(item).toFixed(2)),
    })
  })
  sheet.getColumn('unitPrice').numFmt = '#,##0.00'
  sheet.getColumn('total').numFmt     = '#,##0.00'

  // ── Configuration Detail sheet (only when breakdown is on) ─────────────────
  if (showBreakdown) {
    const detail = wb.addWorksheet(lang === 'en' ? 'Configuration' : 'Konfiguracija')
    detail.columns = [
      { header: '#',                                                             key: 'idx',       width: 5  },
      { header: L.product,                                                       key: 'product',   width: 30 },
      { header: lang === 'en' ? 'Characteristic'        : 'Karakteristika',      key: 'char',      width: 22 },
      { header: lang === 'en' ? 'Selected'              : 'Izabrano',            key: 'value',     width: 22 },
      { header: lang === 'en' ? 'Price modifier'        : 'Modifikator',         key: 'mod',       width: 14 },
      ...(showDescriptions
        ? [{ header: lang === 'en' ? 'Description' : 'Opis', key: 'desc' as const, width: 50 }]
        : []),
    ]
    detail.getRow(1).font = { bold: true, color: { argb: 'FF6C7179' } }
    detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } }
    detail.views = [{ state: 'frozen', ySplit: 1 }]

    items.forEach((item, i) => {
      const cfg = (Array.isArray(item.configuration) ? item.configuration : []) as QuotationConfigItem[]
      for (const c of cfg) {
        const row: Record<string, string | number> = {
          idx:     i + 1,
          product: item.product_name,
          char:    c.characteristic_name,
          value:   c.value_label,
          mod:     Number((Number(c.price_modifier) || 0).toFixed(2)),
        }
        if (showDescriptions) {
          row.desc = resolveCharDescription(c.characteristic_description_i18n, lang)
        }
        const r = detail.addRow(row)
        r.getCell('mod').numFmt = '#,##0.00'
        if (showDescriptions) r.getCell('desc').alignment = { wrapText: true, vertical: 'top' }
      }
    })
  }

  // productTexts: append a sheet if any are present for this language
  const ptList: ProductText[] = []
  for (const list of Object.values(productTexts ?? {})) {
    for (const pt of list) if (pt.language === lang) ptList.push(pt)
  }
  if (ptList.length > 0) {
    const pts = wb.addWorksheet(lang === 'en' ? 'Product Texts' : 'Tekstovi proizvoda')
    pts.columns = [
      { header: lang === 'en' ? 'Label' : 'Naziv', key: 'label',   width: 24 },
      { header: lang === 'en' ? 'Type'  : 'Vrsta', key: 'type',    width: 16 },
      { header: lang === 'en' ? 'Content' : 'Sadržaj', key: 'content', width: 80 },
    ]
    pts.getRow(1).font = { bold: true, color: { argb: 'FF6C7179' } }
    for (const pt of ptList) {
      if (!isSectionVisible(layoutSections, `pt-${pt.id}`)) continue
      const row = pts.addRow({ label: pt.label, type: pt.text_type, content: pt.content })
      row.getCell('content').alignment = { wrapText: true, vertical: 'top' }
    }
  }

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
