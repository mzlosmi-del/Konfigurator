import {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  HeightRule,
} from 'docx'
import type {
  Quotation, ProductText, QuotationLineItem, QuotationAdjustment, QuotationConfigItem,
} from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import {
  PDF_LABELS, type TenantProfile, getFooterLabel,
  isSectionVisible, isSectionVisibleOptIn, resolveCharDescription,
} from './pdf/shared'
import { calcLineTotal, calcSubtotal, calcTotal } from './quotations'

type Labels = (typeof PDF_LABELS)[keyof typeof PDF_LABELS]

export interface BuildDocxArgs {
  tenant:          TenantProfile
  quotation:       Quotation
  productTexts?:   Record<string, ProductText[]>
  globalTexts?:    ProductText[]
  layoutSections?: PdfSection[]
  lang:            'en' | 'sr'
}

const NO_BORDER = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const RULE_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  left:   { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  right:  { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
}

function fmtDate(iso: string | null | undefined, locale: 'en-GB' | 'sr-Latn-RS'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale)
}

function fmtMoney(n: number, currency: string | null | undefined): string {
  const cur = currency ?? ''
  return `${n.toFixed(2)} ${cur}`.trim()
}

function plain(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color })],
  })
}

function headingLabel(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [new TextRun({ text, bold: true, size: 18, color: '6C7179' })],
  })
}

function buildBillToBlock(quotation: Quotation, L: Labels): Paragraph[] {
  const lines: Paragraph[] = [headingLabel(L.billTo)]
  if (quotation.customer_name)    lines.push(plain(quotation.customer_name, { bold: true, size: 20 }))
  if (quotation.customer_company) lines.push(plain(quotation.customer_company, { size: 20 }))
  if (quotation.customer_address) {
    for (const part of String(quotation.customer_address).split(/\r?\n/)) {
      if (part.trim()) lines.push(plain(part, { size: 20 }))
    }
  }
  if (quotation.customer_email) lines.push(plain(quotation.customer_email, { size: 20, color: '154BE4' }))
  if (quotation.customer_phone) lines.push(plain(quotation.customer_phone, { size: 20 }))
  return lines
}

function buildQuoteDetailsBlock(
  quotation: Quotation,
  L: Labels,
): Paragraph[] {
  const lines: Paragraph[] = [headingLabel(L.quoteDetails)]
  const det = (k: string, v: string) => new Paragraph({
    children: [
      new TextRun({ text: `${k}: `, bold: true, size: 20 }),
      new TextRun({ text: v, size: 20 }),
    ],
  })
  if (quotation.reference_number) lines.push(det(L.reference, quotation.reference_number))
  lines.push(det(L.issued, fmtDate(quotation.created_at, L.dateLocale)))
  if (quotation.valid_until) lines.push(det(L.validUntil, fmtDate(quotation.valid_until, L.dateLocale)))
  if (quotation.currency)    lines.push(det(L.currency, quotation.currency))
  const paymentTerms = (quotation as { payment_terms?: string | null }).payment_terms
  if (paymentTerms) lines.push(det(L.paymentTerms, paymentTerms))
  return lines
}

function buildLineItemsTable(
  items: QuotationLineItem[],
  layoutSections: PdfSection[] | undefined,
  lang: 'en' | 'sr',
  L: Labels,
  currency: string | null | undefined,
): Table {
  const showBreakdownGlobal = isSectionVisible(layoutSections, 'price-breakdown')
  const showDescriptions    = showBreakdownGlobal
    && isSectionVisibleOptIn(layoutSections, 'characteristic-descriptions')

  const headerCells = [L.product, L.qty, L.unitPrice, L.total].map((label, idx) =>
    new TableCell({
      width: { size: idx === 0 ? 55 : 15, type: WidthType.PERCENTAGE },
      shading: { fill: 'F4F5F7' },
      children: [new Paragraph({
        alignment: idx === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
        children: [new TextRun({ text: label, bold: true, size: 18, color: '6C7179' })],
      })],
    })
  )

  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: headerCells })]

  items.forEach((item) => {
    const cfg        = Array.isArray(item.configuration) ? item.configuration : []
    const formulas   = (Array.isArray(item.formulas) ? item.formulas : []).filter(f => (Number(f.amount) || 0) !== 0)
    const itemAdjs   = Array.isArray(item.adjustments) ? item.adjustments : []
    const showBreakdown = showBreakdownGlobal && (cfg.length > 0 || formulas.length > 0)
    const modSum     = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
    const formulaSum = formulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
    const derivedBase = item.unit_price - modSum - formulaSum

    const productCellLines: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: item.product_name, bold: true, size: 20 })] }),
    ]
    if (item.product_sku) {
      productCellLines.push(new Paragraph({
        children: [new TextRun({ text: `SKU: ${item.product_sku}`, size: 16, color: '6C7179' })],
      }))
    }

    if (showBreakdown) {
      productCellLines.push(new Paragraph({
        spacing: { before: 80 },
        children: [
          new TextRun({ text: `${L.basePrice}: ${derivedBase.toFixed(2)}`, size: 16, color: '6C7179' }),
        ],
      }))
      for (const c of cfg as QuotationConfigItem[]) {
        const mod    = Number(c.price_modifier) || 0
        const modStr = mod === 0 ? '—' : `${mod >= 0 ? '+' : ''}${mod.toFixed(2)}`
        productCellLines.push(new Paragraph({
          children: [new TextRun({
            text: `+ ${c.characteristic_name}: ${c.value_label}  (${modStr})`,
            size: 16,
            color: '424448',
          })],
        }))
        if (showDescriptions) {
          const desc = resolveCharDescription(c.characteristic_description_i18n, lang)
          if (desc) {
            for (const line of desc.split(/\r?\n/)) {
              if (!line.trim()) continue
              productCellLines.push(new Paragraph({
                indent: { left: 360 },
                children: [new TextRun({ text: line, size: 14, color: '8A8E94', italics: true })],
              }))
            }
          }
        }
      }
      for (const f of formulas) {
        const amt    = Number(f.amount) || 0
        const amtStr = `${amt >= 0 ? '+' : ''}${amt.toFixed(2)}`
        productCellLines.push(new Paragraph({
          children: [new TextRun({
            text: `ƒ ${f.formula_name}  (${amtStr})`,
            size: 16,
            color: '424448',
          })],
        }))
      }
    }

    if (itemAdjs.length > 0) {
      productCellLines.push(new Paragraph({
        spacing: { before: 80 },
        children: [new TextRun({ text: lang === 'en' ? 'Adjustments' : 'Korekcije', bold: true, size: 16, color: '6C7179' })],
      }))
      for (const a of itemAdjs) {
        const sign = a.type === 'discount' ? '-' : '+'
        const valStr = a.mode === 'percent' ? `${sign}${a.value}%` : `${sign}${a.value.toFixed(2)}`
        productCellLines.push(new Paragraph({
          children: [new TextRun({ text: `${a.label} (${valStr})`, size: 16, color: '424448' })],
        }))
      }
    }

    rows.push(new TableRow({
      height: { value: 200, rule: HeightRule.ATLEAST },
      children: [
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          children: productCellLines,
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: String(item.quantity), size: 20 })],
          })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: fmtMoney(item.unit_price, currency), size: 20 })],
          })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: fmtMoney(calcLineTotal(item), currency), bold: true, size: 20 })],
          })],
        }),
      ],
    }))
  })

  return new Table({
    width:  { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top:           { style: BorderStyle.SINGLE, size: 4, color: 'D2D4D8' },
      bottom:        { style: BorderStyle.SINGLE, size: 4, color: 'D2D4D8' },
      left:          RULE_BORDER.left,
      right:         RULE_BORDER.right,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'EDEEF1' },
      insideVertical:   NO_BORDER.left,
    },
  })
}

function buildTotalsBlock(
  items: QuotationLineItem[],
  adjs: QuotationAdjustment[],
  L: Labels,
  currency: string | null | undefined,
): Paragraph[] {
  const subtotal = calcSubtotal(items)
  const total    = calcTotal(subtotal, adjs)
  const para = (label: string, value: string, bold = false) => new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 40 },
    children: [
      new TextRun({ text: `${label}   `, bold, size: 20 }),
      new TextRun({ text: value, bold, size: 20 }),
    ],
  })
  const out: Paragraph[] = [para(L.subtotal, fmtMoney(subtotal, currency))]
  let running = subtotal
  for (const a of adjs) {
    const amount  = a.mode === 'percent' ? (running * a.value) / 100 : a.value
    const applied = a.type === 'discount' ? -amount : amount
    out.push(para(a.label, `${applied >= 0 ? '+' : ''}${fmtMoney(applied, currency)}`))
    running += applied
  }
  out.push(para(L.totalDue, fmtMoney(total, currency), true))
  return out
}

function buildConfigurableSections(
  quotation: Quotation,
  layoutSections: PdfSection[] | undefined,
  globalTexts: ProductText[] | undefined,
  productTexts: Record<string, ProductText[]> | undefined,
  L: Labels,
  lang: 'en' | 'sr',
): Paragraph[] {
  const out: Paragraph[] = []
  const globalTextMap = Object.fromEntries((globalTexts ?? []).map(gt => [gt.id, gt]))
  // Build productText lookup
  const productTextMap: Record<string, ProductText> = {}
  for (const list of Object.values(productTexts ?? {})) {
    for (const pt of list) productTextMap[pt.id] = pt
  }

  const ordered = (layoutSections ?? []).filter(s => !s.locked && s.visible
    && s.id !== 'price-breakdown' && s.id !== 'characteristic-descriptions')

  // Use a Map of section ids that are always rendered when no layoutSections supplied.
  if (!layoutSections) {
    // Legacy fallback: notes -> terms -> globalTexts
    if (quotation.notes) {
      out.push(headingLabel(L.notes))
      for (const line of String(quotation.notes).split(/\r?\n/)) {
        if (line.trim()) out.push(plain(line, { size: 20 }))
      }
    }
    out.push(headingLabel(L.termsHeader))
    for (const line of L.termsLines) out.push(plain(line, { size: 18, color: '424448' }))
    for (const gt of (globalTexts ?? []).filter(g => g.language === lang)) {
      out.push(headingLabel(gt.label))
      for (const line of String(gt.content).split(/\r?\n/)) {
        if (line.trim()) out.push(plain(line, { size: 20 }))
      }
    }
    return out
  }

  for (const section of ordered) {
    if (section.id === 'notes') {
      if (!quotation.notes) continue
      out.push(headingLabel(L.notes))
      for (const line of String(quotation.notes).split(/\r?\n/)) {
        if (line.trim()) out.push(plain(line, { size: 20 }))
      }
    } else if (section.id === 'terms') {
      out.push(headingLabel(L.termsHeader))
      for (const line of L.termsLines) out.push(plain(line, { size: 18, color: '424448' }))
    } else if (section.textId) {
      const gt = globalTextMap[section.textId]
      if (!gt || gt.language !== lang) continue
      out.push(headingLabel(gt.label))
      for (const line of String(gt.content).split(/\r?\n/)) {
        if (line.trim()) out.push(plain(line, { size: 20 }))
      }
    } else if (section.productTextId) {
      const pt = productTextMap[section.productTextId]
      if (!pt || pt.language !== lang) continue
      out.push(headingLabel(`${pt.label}${section.group ? ` — ${section.group}` : ''}`))
      for (const line of String(pt.content).split(/\r?\n/)) {
        if (line.trim()) out.push(plain(line, { size: 20 }))
      }
    }
  }

  return out
}

export async function buildQuotationDocxBytes(args: BuildDocxArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang } = args
  const L = PDF_LABELS[lang]
  const items = (Array.isArray(quotation.line_items)  ? quotation.line_items  : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]

  const billTo  = buildBillToBlock(quotation, L)
  const details = buildQuoteDetailsBlock(quotation, L)

  const billToDetailsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER.top, bottom: NO_BORDER.bottom, left: NO_BORDER.left, right: NO_BORDER.right,
      insideHorizontal: NO_BORDER.top, insideVertical: NO_BORDER.left,
    },
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: billTo }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: details }),
      ],
    })],
  })

  const doc = new Document({
    creator: tenant.name,
    title:   quotation.title ?? quotation.reference_number ?? L.quotation,
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
      },
      children: [
        // Title row
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: L.quotation, bold: true, size: 44, color: '151928' })],
        }),
        plain(tenant.name, { bold: true, size: 22 }),
        ...[tenant.company_address, tenant.company_phone, tenant.company_email, tenant.company_website]
          .filter((v): v is string => !!v && v.trim().length > 0)
          .map(v => plain(v, { size: 18, color: '6C7179' })),
        new Paragraph({ spacing: { before: 200 } }),

        billToDetailsTable,

        new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: L.lineItems, bold: true, size: 20, color: '6C7179' })] }),
        buildLineItemsTable(items, layoutSections, lang, L, quotation.currency),

        ...buildTotalsBlock(items, adjs, L, quotation.currency),

        ...buildConfigurableSections(quotation, layoutSections, globalTexts, productTexts, L, lang),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 360 },
          children: [new TextRun({ text: getFooterLabel(tenant, L.footer), size: 14, color: 'ADB1B7' })],
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

export function openDocxBlob(bytes: Uint8Array, filename = 'quotation.docx') {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
