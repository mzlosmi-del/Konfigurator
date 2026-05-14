import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  HeightRule, ShadingType, PageNumber,
  Footer,
} from 'docx'
import type {
  Quotation, ProductText, QuotationLineItem, QuotationAdjustment, QuotationConfigItem,
} from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import {
  PDF_LABELS, type TenantProfile, getFooterLabel, loadLogoBytes,
  isSectionVisible, isSectionVisibleOptIn, resolveCharDescription, buildOrderedSections,
} from './pdf/shared'

type Labels = (typeof PDF_LABELS)[keyof typeof PDF_LABELS]

export interface BuildDocxArgs {
  tenant:          TenantProfile
  quotation:       Quotation
  productTexts?:   Record<string, ProductText[]>
  globalTexts?:    ProductText[]
  layoutSections?: PdfSection[]
  lang:            'en' | 'sr'
}

// ── Palette (matches PDF modern template) ──────────────────────────────────
const HEX = {
  ink:      '151928',
  muted:    '6C7179',
  faint:    'ADB1B7',
  rowAlt:   'F7F8FB',
  termsBox: 'F4F5F7',
  rule:     'D2D4D8',
  accent:   '154BE4',
  positive: '0C9563',
  negative: 'D22E2E',
}

const NO_BORDER = {
  style: BorderStyle.NONE, size: 0, color: 'FFFFFF',
}

const RULE_BORDER = {
  style: BorderStyle.SINGLE, size: 4, color: HEX.rule,
}

function fmtLongDate(iso: string | null | undefined, locale: 'en-GB' | 'sr-Latn-RS'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { dateStyle: 'long' })
}

/** Half-points (docx font size unit). PDF point ≈ docx half-point / 2. */
const SZ = {
  hugeTitle: 44,  // QUOTATION word (≈22pt)
  big:       30,  // customer name
  body:      19,  // body text (9.5pt)
  smallBody: 17,  // 8.5pt
  small:     16,  // 8pt
  tiny:      14,  // 7pt section labels
  total:     30,  // 15pt total amount
}

function txt(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    bold:    opts.bold,
    size:    opts.size,
    color:   opts.color,
    italics: opts.italics,
    font:    'Noto Sans',
  })
}

function p(children: TextRun[], opts: { align?: typeof AlignmentType[keyof typeof AlignmentType]; spacingBefore?: number; spacingAfter?: number; indent?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    indent:    opts.indent ? { left: opts.indent } : undefined,
    spacing:   { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? 0 },
    children,
  })
}

function blank(spacing = 80): Paragraph {
  return new Paragraph({ spacing: { before: spacing, after: 0 }, children: [] })
}

function ruleParagraph(): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border:  { bottom: RULE_BORDER },
    children: [],
  })
}

function sectionLabel(label: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 240, after: 40 },
      children: [txt(label, { bold: true, size: SZ.tiny, color: HEX.muted })],
    }),
    new Paragraph({ border: { bottom: RULE_BORDER }, spacing: { after: 120 }, children: [] }),
  ]
}

function cellNoBorder(children: Paragraph[], opts: { width?: number; valign?: 'top' | 'center' | 'bottom'; rightAlignParas?: boolean } = {}): TableCell {
  // docx's TableCell.verticalAlign rejects the "both" variant of VerticalAlign,
  // so accept only the three standard positions and cast at the boundary.
  return new TableCell({
    width:    opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: opts.valign as unknown as ConstructorParameters<typeof TableCell>[0]['verticalAlign'],
    children,
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
    },
  })
}

function buildHeader(
  tenant: TenantProfile,
  quotation: Quotation,
  L: Labels,
  logo: { bytes: Uint8Array; extension: 'png' | 'jpg' | 'gif' | 'bmp'; width: number; height: number } | null,
): Table {
  // Logo cell — scale to fit a 148×56pt box, like the PDF.
  let logoPara: Paragraph
  if (logo && logo.width > 0 && logo.height > 0) {
    const maxW = 148, maxH = 56
    const ratio = Math.min(maxW / logo.width, maxH / logo.height, 1)
    const w = Math.max(20, logo.width  * ratio)
    const h = Math.max(20, logo.height * ratio)
    logoPara = new Paragraph({
      children: [new ImageRun({
        data: logo.bytes,
        type: logo.extension,
        transformation: { width: w, height: h },
      } as unknown as ConstructorParameters<typeof ImageRun>[0])],
    })
  } else {
    logoPara = p([txt(tenant.name.toUpperCase(), { bold: true, size: 26, color: HEX.ink })])
  }

  // Right side title block
  const right: Paragraph[] = [
    p([txt(L.quotation, { bold: true, size: SZ.hugeTitle, color: HEX.ink })], { align: AlignmentType.RIGHT }),
  ]
  if (quotation.title) {
    right.push(p([txt(quotation.title, { size: SZ.smallBody, color: HEX.muted })], { align: AlignmentType.RIGHT, spacingBefore: 120 }))
  }
  if (quotation.reference_number) {
    right.push(p([txt(quotation.reference_number, { size: SZ.smallBody, color: HEX.muted })], { align: AlignmentType.RIGHT, spacingBefore: 60 }))
  }
  right.push(p([txt(fmtLongDate(quotation.created_at, L.dateLocale), { size: SZ.small, color: HEX.faint })], { align: AlignmentType.RIGHT, spacingBefore: 60 }))
  if (quotation.valid_until) {
    right.push(p([txt(`${L.validUntil}: ${fmtLongDate(quotation.valid_until, L.dateLocale)}`, { size: SZ.small, color: HEX.faint })], { align: AlignmentType.RIGHT, spacingBefore: 40 }))
  }

  return new Table({
    width:  { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [new TableRow({
      children: [
        cellNoBorder([logoPara], { width: 45, valign: 'center' }),
        cellNoBorder(right,      { width: 55, valign: 'center' }),
      ],
    })],
  })
}

function buildSenderStrip(tenant: TenantProfile, L: Labels): Paragraph[] {
  const out: Paragraph[] = [
    p([txt(tenant.name.toUpperCase(), { bold: true, size: SZ.body, color: HEX.ink })], { spacingBefore: 120 }),
  ]
  const parts = [
    tenant.contact_person,
    tenant.company_address,
    tenant.company_phone,
    tenant.company_email,
    tenant.company_website,
  ].filter((v): v is string => !!v && v.trim().length > 0)
  if (parts.length > 0) {
    out.push(p([txt(parts.join('  ·  '), { size: SZ.small, color: HEX.muted })], { spacingBefore: 40 }))
  }
  const regParts = [
    tenant.vat_number         ? `${L.vatNumber} ${tenant.vat_number}`         : null,
    tenant.company_reg_number ? `${L.regNumber} ${tenant.company_reg_number}` : null,
  ].filter((v): v is string => !!v)
  if (regParts.length > 0) {
    out.push(p([txt(regParts.join('   '), { size: SZ.small, color: HEX.faint })], { spacingBefore: 40 }))
  }
  return out
}

function buildBillToAndDetails(quotation: Quotation, tenant: TenantProfile, L: Labels): Table {
  // ── Left: Bill To ────────────────────────────────────────────────────────
  const left: Paragraph[] = [
    p([txt(L.billTo, { bold: true, size: SZ.tiny, color: HEX.muted })], { spacingAfter: 60 }),
  ]
  if (quotation.customer_name)    left.push(p([txt(quotation.customer_name,    { bold: true, size: 24, color: HEX.ink })]))
  if (quotation.customer_company) left.push(p([txt(quotation.customer_company, { size: SZ.body, color: HEX.ink })]))
  if (quotation.customer_email)   left.push(p([txt(quotation.customer_email,   { size: SZ.body, color: HEX.accent })]))
  if (quotation.customer_phone)   left.push(p([txt(quotation.customer_phone,   { size: SZ.body, color: HEX.muted })]))
  if (quotation.customer_address) {
    for (const line of String(quotation.customer_address).split(/\r?\n/)) {
      if (line.trim()) left.push(p([txt(line, { size: SZ.body, color: HEX.muted })]))
    }
  }
  if (quotation.customer_vat_number) {
    left.push(p([txt(`${L.customerVat}: ${quotation.customer_vat_number}`, { size: SZ.small, color: HEX.faint })]))
  }
  if (quotation.delivery_address) {
    left.push(p([txt(L.shipTo, { bold: true, size: SZ.tiny, color: HEX.muted })], { spacingBefore: 120, spacingAfter: 60 }))
    for (const line of String(quotation.delivery_address).split(/\r?\n/)) {
      if (line.trim()) left.push(p([txt(line, { size: SZ.body, color: HEX.muted })]))
    }
  }

  // ── Right: Quote Details ─────────────────────────────────────────────────
  const right: Paragraph[] = [
    p([txt(L.quoteDetails, { bold: true, size: SZ.tiny, color: HEX.muted })], { spacingAfter: 60 }),
  ]
  const detail = (label: string, value: string) => new Paragraph({
    spacing: { after: 40 },
    children: [
      txt(label, { size: SZ.smallBody, color: HEX.muted }),
      txt('\t',  { size: SZ.smallBody }),
      txt(value, { bold: true, size: SZ.smallBody, color: HEX.ink }),
    ],
    tabStops: [{ type: 'right', position: 4800 }],
  })
  if (quotation.reference_number) right.push(detail(L.reference,    quotation.reference_number))
  right.push(detail(L.issued, fmtLongDate(quotation.created_at, L.dateLocale)))
  if (quotation.valid_until)      right.push(detail(L.validUntil,   fmtLongDate(quotation.valid_until, L.dateLocale)))
  if (quotation.currency)         right.push(detail(L.currency,     quotation.currency))
  if (tenant.contact_person)      right.push(detail(L.preparedBy,   tenant.contact_person))
  if (quotation.payment_terms)    right.push(detail(L.paymentTerms, quotation.payment_terms))

  return new Table({
    width:  { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: HEX.rule },
    },
    rows: [new TableRow({
      children: [
        cellNoBorder(left,  { width: 50, valign: 'top' }),
        cellNoBorder(right, { width: 50, valign: 'top' }),
      ],
    })],
  })
}

function buildLineItemsTable(
  items: QuotationLineItem[],
  productTexts: Record<string, ProductText[]> | undefined,
  layoutSections: PdfSection[] | undefined,
  lang: 'en' | 'sr',
  L: Labels,
): Table {
  const showBreakdownGlobal = isSectionVisible(layoutSections, 'price-breakdown')
  const showDescriptions    = showBreakdownGlobal
    && isSectionVisibleOptIn(layoutSections, 'characteristic-descriptions')

  const headerStyle = { bold: true, size: SZ.tiny, color: HEX.muted }

  const ruleCell = (children: Paragraph[], width: number, opts: { rightAlign?: boolean; bottomRule?: boolean; shade?: string } = {}) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: opts.shade ? { type: ShadingType.SOLID, color: opts.shade, fill: opts.shade } : undefined,
    children: children.map(par => par),
    borders: {
      top:    NO_BORDER,
      bottom: opts.bottomRule ? { style: BorderStyle.SINGLE, size: 4, color: HEX.rule } : NO_BORDER,
      left:   NO_BORDER, right: NO_BORDER,
    },
  })

  const rows: TableRow[] = []

  // Header row
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      ruleCell([p([txt('#',       { ...headerStyle })])],                                                 4,  { bottomRule: true }),
      ruleCell([p([txt(L.product, { ...headerStyle })])],                                                 50, { bottomRule: true }),
      ruleCell([p([txt(L.qty,     { ...headerStyle })], { align: AlignmentType.RIGHT })],                 8,  { bottomRule: true, rightAlign: true }),
      ruleCell([p([txt(L.uom,     { ...headerStyle })])],                                                 10, { bottomRule: true }),
      ruleCell([p([txt(L.unitPrice, { ...headerStyle })], { align: AlignmentType.RIGHT })],               14, { bottomRule: true, rightAlign: true }),
      ruleCell([p([txt(L.total,   { ...headerStyle })], { align: AlignmentType.RIGHT })],                 14, { bottomRule: true, rightAlign: true }),
    ],
  }))

  items.forEach((item, i) => {
    const cfg      = Array.isArray(item.configuration) ? item.configuration : []
    const formulas = (Array.isArray(item.formulas) ? item.formulas : []).filter(f => (Number(f.amount) || 0) !== 0)
    const itemAdjs = Array.isArray(item.adjustments) ? item.adjustments : []
    const ptexts   = (productTexts?.[item.product_id] ?? []).filter(pt => pt.language === lang)
    const showBreakdown = showBreakdownGlobal && (cfg.length + formulas.length > 0)
    const modSum     = cfg.reduce((s, c) => s + (Number(c.price_modifier) || 0), 0)
    const formulaSum = formulas.reduce((s, f) => s + (Number(f.amount) || 0), 0)
    const baseLine   = item.unit_price * item.quantity
    const derivedBase = item.unit_price - modSum - formulaSum
    const lineTotal  = baseLine // unit_price already includes mods+formulas
    const shade      = i % 2 === 1 ? HEX.rowAlt : undefined

    const productCol: Paragraph[] = [
      p([txt(item.product_name, { bold: true, size: 20, color: HEX.ink })]),
    ]
    if (item.product_sku) {
      productCol.push(p([txt(`SKU: ${item.product_sku}`, { size: 15, color: HEX.muted })]))
    }

    if (showBreakdown) {
      productCol.push(new Paragraph({
        spacing: { before: 80 },
        tabStops: [{ type: 'right', position: 5200 }],
        children: [
          txt(L.basePrice, { size: SZ.small, color: HEX.muted }),
          txt('\t', { size: SZ.small }),
          txt(derivedBase.toFixed(2), { size: SZ.small, color: HEX.muted }),
        ],
      }))
      for (const c of cfg as QuotationConfigItem[]) {
        const mod    = Number(c.price_modifier) || 0
        const modStr = mod === 0 ? '—' : `${mod >= 0 ? '+' : ''}${mod.toFixed(2)}`
        const modColor = mod > 0 ? HEX.positive : mod < 0 ? HEX.negative : HEX.muted
        productCol.push(new Paragraph({
          tabStops: [{ type: 'right', position: 5200 }],
          children: [
            txt(`+ ${c.characteristic_name}: ${c.value_label}`, { size: SZ.small, color: HEX.muted }),
            txt('\t', { size: SZ.small }),
            txt(modStr, { size: SZ.small, color: modColor }),
          ],
        }))
        if (showDescriptions) {
          const desc = resolveCharDescription(c.characteristic_description_i18n, lang)
          if (desc) {
            for (const line of desc.split(/\r?\n/)) {
              if (!line.trim()) continue
              productCol.push(new Paragraph({
                indent: { left: 360 },
                children: [txt(line, { size: 14, color: HEX.faint, italics: true })],
              }))
            }
          }
        }
      }
      for (const f of formulas) {
        const amt    = Number(f.amount) || 0
        const amtStr = `${amt >= 0 ? '+' : ''}${amt.toFixed(2)}`
        productCol.push(new Paragraph({
          tabStops: [{ type: 'right', position: 5200 }],
          children: [
            txt(`ƒ ${f.formula_name}`, { size: SZ.small, color: HEX.muted }),
            txt('\t', { size: SZ.small }),
            txt(amtStr, { size: SZ.small, color: amt >= 0 ? HEX.positive : HEX.negative }),
          ],
        }))
      }
    }

    for (const pt of ptexts) {
      productCol.push(p([txt(`${pt.label}:`, { bold: true, size: 15, color: HEX.muted })], { spacingBefore: 80 }))
      for (const line of String(pt.content).split(/\r?\n/)) {
        if (line.trim()) productCol.push(p([txt(line, { size: SZ.small, color: HEX.muted })], { indent: 240 }))
      }
    }

    if (itemAdjs.length > 0) {
      productCol.push(p([txt(L.subtotal, { size: SZ.small, color: HEX.muted })], { spacingBefore: 80 }))
      let runItem = baseLine
      for (const adj of itemAdjs) {
        const amt     = adj.mode === 'percent' ? (runItem * adj.value) / 100 : adj.value
        const applied = adj.type === 'discount' ? -amt : amt
        runItem += applied
        const lbl = `${adj.label || adj.type}${adj.mode === 'percent' ? ` (${adj.value}%)` : ''}`
        productCol.push(new Paragraph({
          tabStops: [{ type: 'right', position: 5200 }],
          children: [
            txt(lbl, { size: SZ.small, color: HEX.muted }),
            txt('\t', { size: SZ.small }),
            txt(`${applied >= 0 ? '+' : ''}${applied.toFixed(2)}`, {
              size: SZ.small,
              color: applied >= 0 ? HEX.positive : HEX.negative,
            }),
          ],
        }))
      }
    }

    rows.push(new TableRow({
      height: { value: 320, rule: HeightRule.ATLEAST },
      children: [
        ruleCell([p([txt(String(i + 1), { size: SZ.smallBody, color: HEX.faint })])], 4, { shade }),
        ruleCell(productCol, 50, { shade }),
        ruleCell([p([txt(String(item.quantity), { size: SZ.body, color: HEX.ink })], { align: AlignmentType.RIGHT })], 8, { shade }),
        ruleCell([p([txt(item.unit_of_measure ?? '—', { size: SZ.body, color: HEX.muted })])], 10, { shade }),
        ruleCell([p([txt(item.unit_price.toFixed(2), { size: SZ.body, color: HEX.ink })], { align: AlignmentType.RIGHT })], 14, { shade }),
        ruleCell([p([txt(lineTotal.toFixed(2), { bold: true, size: SZ.body, color: HEX.ink })], { align: AlignmentType.RIGHT })], 14, { shade }),
      ],
    }))
  })

  return new Table({
    width:  { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: HEX.rule },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX.rule },
      left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'EDEEF1' },
      insideVertical:   NO_BORDER,
    },
    rows,
  })
}

function buildTotalsBlock(
  quotation: Quotation,
  adjs: QuotationAdjustment[],
  L: Labels,
): Table {
  const cur = quotation.currency
  const rows: TableRow[] = []

  const labelCell = (s: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => new TableCell({
    children: [p([txt(s, { bold: opts.bold, size: opts.size ?? SZ.body, color: opts.color ?? HEX.muted })], { align: AlignmentType.RIGHT })],
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  })
  const valueCell = (s: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => new TableCell({
    children: [p([txt(s, { bold: opts.bold, size: opts.size ?? SZ.body, color: opts.color ?? HEX.ink })], { align: AlignmentType.RIGHT })],
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  })

  rows.push(new TableRow({ children: [
    new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({})], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    labelCell(L.subtotal),
    valueCell(`${quotation.subtotal.toFixed(2)} ${cur}`),
  ]}))

  let running = quotation.subtotal
  for (const adj of adjs) {
    const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    const sign    = adj.type === 'discount' ? -1 : 1
    const applied = sign * amount
    running += applied
    const pct    = adj.mode === 'percent' ? ` ${adj.value}%` : ''
    const label  = `${adj.label}${pct}`
    const amtStr = `${applied >= 0 ? '+' : ''}${applied.toFixed(2)} ${cur}`
    rows.push(new TableRow({ children: [
      new TableCell({ children: [new Paragraph({})], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
      labelCell(label, { size: SZ.body }),
      valueCell(amtStr, { bold: true, color: applied >= 0 ? HEX.positive : HEX.negative }),
    ]}))
  }

  // Spacer rule + total
  rows.push(new TableRow({ children: [
    new TableCell({ children: [new Paragraph({ border: { bottom: RULE_BORDER }, children: [] })], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    new TableCell({ children: [new Paragraph({ border: { bottom: RULE_BORDER }, children: [] })], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    new TableCell({ children: [new Paragraph({ border: { bottom: RULE_BORDER }, children: [] })], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
  ]}))

  rows.push(new TableRow({ children: [
    new TableCell({ children: [new Paragraph({})], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    labelCell(L.totalDue, { bold: true, size: SZ.smallBody, color: HEX.muted }),
    valueCell(`${quotation.total_price.toFixed(2)} ${cur}`, { bold: true, size: SZ.total, color: HEX.ink }),
  ]}))

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows,
  })
}

function buildNotesSection(quotation: Quotation, L: Labels): Paragraph[] {
  if (!quotation.notes) return []
  const out: Paragraph[] = [ruleParagraph(), ...sectionLabel(L.notes)]
  for (const line of String(quotation.notes).split(/\r?\n/)) {
    if (line.trim()) out.push(p([txt(line, { size: SZ.body, color: HEX.ink })]))
  }
  return out
}

function buildTermsSection(L: Labels): Paragraph[] {
  const out: Paragraph[] = [ruleParagraph(), ...sectionLabel(L.termsHeader)]
  for (const line of L.termsLines) {
    out.push(new Paragraph({
      shading: { type: ShadingType.SOLID, color: HEX.termsBox, fill: HEX.termsBox },
      spacing: { before: 0, after: 40 },
      indent:  { left: 160, right: 160 },
      children: [txt(line, { size: SZ.smallBody, color: HEX.ink })],
    }))
  }
  return out
}

function buildGlobalTextSection(textBlock: ProductText): Paragraph[] {
  const out: Paragraph[] = [ruleParagraph(), ...sectionLabel(textBlock.label.toUpperCase())]
  for (const line of String(textBlock.content).split(/\r?\n/)) {
    if (line.trim()) out.push(p([txt(line, { size: SZ.body, color: HEX.ink })]))
  }
  return out
}

export async function buildQuotationDocxBytes(args: BuildDocxArgs): Promise<Uint8Array> {
  const { tenant, quotation, productTexts, globalTexts, layoutSections, lang } = args
  const L = PDF_LABELS[lang]
  const items = (Array.isArray(quotation.line_items)  ? quotation.line_items  : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]

  const logo = await loadLogoBytes(tenant.logo_url)

  const children: (Paragraph | Table)[] = [
    buildHeader(tenant, quotation, L, logo),
    ruleParagraph(),
    ...buildSenderStrip(tenant, L),
    ruleParagraph(),
    buildBillToAndDetails(quotation, tenant, L),
    ...sectionLabel(L.lineItems),
    buildLineItemsTable(items, productTexts, layoutSections, lang, L),
    blank(160),
    buildTotalsBlock(quotation, adjs, L),
  ]

  // Notes / Terms / Global texts — respect dialog ordering and visibility.
  const orderedSections = buildOrderedSections(layoutSections, globalTexts, lang)
  for (const section of orderedSections) {
    if (!section.visible) continue
    if (section.id === 'notes') {
      if (isSectionVisible(layoutSections, 'notes')) children.push(...buildNotesSection(quotation, L))
    } else if (section.id === 'terms') {
      if (isSectionVisible(layoutSections, 'terms')) children.push(...buildTermsSection(L))
    } else if (section.textId) {
      const gt = (globalTexts ?? []).find(t => t.id === section.textId && t.language === lang)
      if (gt) children.push(...buildGlobalTextSection(gt))
    }
  }

  const validStr = quotation.valid_until
    ? L.validityText(fmtLongDate(quotation.valid_until, L.dateLocale))
    : L.contactText

  const doc = new Document({
    creator: tenant.name,
    title:   quotation.title ?? quotation.reference_number ?? L.quotation,
    styles: {
      default: {
        document: { run: { font: 'Noto Sans', size: SZ.body } },
      },
    },
    sections: [{
      properties: {
        page: {
          size:   { width: 11906, height: 16838 }, // A4 in twentieths-of-a-point
          margin: { top: 720, bottom: 1080, left: 720, right: 720, footer: 360 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({ border: { top: RULE_BORDER }, spacing: { after: 60 }, children: [] }),
            new Paragraph({
              tabStops: [
                { type: 'center', position: 5160 },
                { type: 'right',  position: 10320 },
              ],
              children: [
                txt(validStr, { size: SZ.small, color: HEX.muted }),
                txt('\t', { size: SZ.small }),
                txt(`${L.page} `, { size: SZ.small, color: HEX.muted }),
                new TextRun({ children: [PageNumber.CURRENT], size: SZ.small, color: HEX.muted, font: 'Noto Sans' }),
                txt(` ${L.of} `, { size: SZ.small, color: HEX.muted }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SZ.small, color: HEX.muted, font: 'Noto Sans' }),
                txt('\t', { size: SZ.small }),
                txt(getFooterLabel(tenant, L.footer), { size: SZ.small, color: HEX.faint }),
              ],
            }),
          ],
        }),
      },
      children,
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
