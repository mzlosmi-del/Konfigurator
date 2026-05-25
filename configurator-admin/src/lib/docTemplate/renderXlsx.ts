// Generic XLSX renderer: walks the same block tree as renderPdf.ts and lays the
// blocks out on a 12-column (A–L) grid, mirroring the ~A4 grid the existing
// quotation XLSX generator uses. Each block consumes one or more rows; styling
// maps through the shared style table (style.ts).

import ExcelJS from 'exceljs'
import type { Quotation, TenantText } from '@/types/database'
import type { TenantProfile } from '@/lib/pdf/shared'
import type { Lang } from '@/i18n'
import type { Block, TableColumn, BlockStyle, StyleAlign } from './types'
import { buildTemplateContext, type ImageResolver } from './context'
import type { DocumentTemplateDefinition } from './types'
import { evaluateCondition } from './conditions'
import { interpolate, resolveDisplay, resolveCollection, type ScopeStack } from './resolvePath'
import { SIZE_PT, HEADING_SIZE, colorHex, sizePt, isBold, alignOf, colorOf } from './style'

export interface RenderXlsxArgs {
  definition: DocumentTemplateDefinition
  quotation:  Quotation
  tenant:     TenantProfile
  texts:      TenantText[]
  lang:       Lang
  images?:    ImageResolver
}

const FONT = 'Calibri'
const COLS = 12              // A..L
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function alignH(a: StyleAlign): 'left' | 'center' | 'right' { return a }
// exceljs ARGB wants an alpha prefix on the 6-digit hex.
const argb = (color: BlockStyle['color']) => `FF${colorHex(color ?? 'ink')}`

export async function renderTemplateToXlsx(args: RenderXlsxArgs): Promise<Uint8Array> {
  const ctx = buildTemplateContext(args.quotation, args.tenant, args.texts, args.lang, args.images)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Document', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  ws.columns = COL_LETTERS.map(() => ({ width: 9 }))

  let row = 1

  function styledText(text: string, style: BlockStyle | undefined, ptOverride?: number, alignOverride?: StyleAlign) {
    ws.mergeCells(`A${row}:L${row}`)
    const cell = ws.getCell(`A${row}`)
    cell.value = text
    cell.font = { name: FONT, bold: isBold(style), size: ptOverride ?? sizePt(style), color: { argb: argb(colorOf(style)) } }
    cell.alignment = { horizontal: alignH(alignOverride ?? alignOf(style)), vertical: 'middle', wrapText: true }
    row += 1
  }

  function emit(blocks: Block[], scope: ScopeStack) {
    for (const block of blocks) {
      if (!evaluateCondition(block.visible, ctx, scope)) continue
      emitBlock(block, scope)
    }
  }

  function emitBlock(block: Block, scope: ScopeStack) {
    switch (block.kind) {
      case 'text':
        styledText(interpolate(block.content, ctx, scope), block.style)
        break
      case 'heading':
        styledText(interpolate(block.content, ctx, scope), { ...block.style, weight: 'bold' }, SIZE_PT[HEADING_SIZE[block.level]])
        break
      case 'key-value':
        for (const kv of block.rows) {
          // label in A:C, value in D:L
          ws.mergeCells(`A${row}:C${row}`)
          ws.mergeCells(`D${row}:L${row}`)
          const lc = ws.getCell(`A${row}`)
          lc.value = interpolate(kv.label, ctx, scope)
          lc.font = { name: FONT, bold: true, size: sizePt(block.style), color: { argb: argb('muted') } }
          const vc = ws.getCell(`D${row}`)
          vc.value = resolveDisplay(ctx, scope, kv.value)
          vc.font = { name: FONT, size: sizePt(block.style), color: { argb: argb(colorOf(block.style)) } }
          vc.alignment = { wrapText: true }
          row += 1
        }
        break
      case 'line-items-table':
        emitTable(block.columns, scope, block.showSummary !== false)
        break
      case 'divider': {
        const cell = ws.getCell(`A${row}`)
        ws.mergeCells(`A${row}:L${row}`)
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFD2D4D8' } } }
        row += 1
        break
      }
      case 'spacer':
        // Approximate pt height as worksheet row height; consume one row.
        ws.getRow(row).height = Math.max(6, block.height)
        row += 1
        break
      case 'repeater':
        for (const frame of resolveCollection(ctx, scope, block.over)) emit(block.children, [...scope, frame])
        break
      case 'group':
        emit(block.children, scope)
        break
      case 'image':
        if (block.source === 'tenant_logo' && ctx.tenant.name) {
          styledText(ctx.tenant.name, { weight: 'bold', size: 'lg' }, SIZE_PT.lg)
        }
        break
    }
  }

  function emitTable(columns: TableColumn[], scope: ScopeStack, showSummary: boolean) {
    if (columns.length === 0) return
    const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0)
    // Distribute the 12 columns across table columns by weight.
    const spans: number[] = columns.map(c => Math.max(1, Math.round((COLS * (c.width ?? 1)) / totalWeight)))
    // Adjust so spans total exactly 12.
    let diff = COLS - spans.reduce((s, n) => s + n, 0)
    for (let i = 0; diff !== 0 && i < spans.length; i = (i + 1) % spans.length) {
      if (diff > 0) { spans[i] += 1; diff -= 1 } else if (spans[i] > 1) { spans[i] -= 1; diff += 1 }
    }

    const writeRow = (cells: { text: string; style: BlockStyle; align: StyleAlign }[]) => {
      let start = 0
      cells.forEach((cell, i) => {
        const from = COL_LETTERS[start]
        const to = COL_LETTERS[start + spans[i] - 1]
        if (spans[i] > 1) ws.mergeCells(`${from}${row}:${to}${row}`)
        const c = ws.getCell(`${from}${row}`)
        c.value = cell.text
        c.font = { name: FONT, bold: isBold(cell.style), size: sizePt(cell.style), color: { argb: argb(colorOf(cell.style)) } }
        c.alignment = { horizontal: alignH(cell.align), vertical: 'middle', wrapText: true }
        start += spans[i]
      })
      row += 1
    }

    // Header
    writeRow(columns.map(c => ({ text: interpolate(c.header, ctx, scope), style: { weight: 'bold', color: 'muted', size: 'sm' } as BlockStyle, align: c.align ?? 'left' })))
    // Body
    for (const frame of resolveCollection(ctx, scope, 'quotation.line_items')) {
      const rowScope: ScopeStack = [...scope, frame]
      writeRow(columns.map(c => ({ text: resolveDisplay(ctx, rowScope, c.value), style: { size: 'sm' } as BlockStyle, align: c.align ?? 'left' })))
    }

    if (showSummary) {
      const cur = ctx.currency
      const summary = (lbl: string, amount: string, bold: boolean) => {
        ws.mergeCells(`G${row}:I${row}`)
        ws.mergeCells(`J${row}:L${row}`)
        const lc = ws.getCell(`G${row}`)
        lc.value = lbl
        lc.font = { name: FONT, bold, size: SIZE_PT.sm, color: { argb: argb(bold ? 'ink' : 'muted') } }
        lc.alignment = { horizontal: 'right' }
        const vc = ws.getCell(`J${row}`)
        vc.value = amount
        vc.font = { name: FONT, bold, size: SIZE_PT.sm, color: { argb: argb(bold ? 'accent' : 'ink') } }
        vc.alignment = { horizontal: 'right' }
        row += 1
      }
      summary(label('Subtotal', 'Međuzbir'), `${ctx.quotation.subtotal.toFixed(2)} ${cur}`, false)
      summary(label('Total', 'Ukupno'), `${ctx.quotation.total.toFixed(2)} ${cur}`, true)
    }
  }

  function label(en: string, sr: string): string {
    return args.lang === 'en' ? en : sr
  }

  emit(args.definition.blocks ?? [], [])

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}
