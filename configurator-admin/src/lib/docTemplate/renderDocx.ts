// Generic DOCX renderer: walks the same block tree as renderPdf.ts and emits a
// Word document via the `docx` library. Blocks map to paragraphs/tables; the
// style enums map through the shared style table (style.ts).

import {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
} from 'docx'
import type { Quotation, TenantText } from '@/types/database'
import type { TenantProfile } from '@/lib/pdf/shared'
import type { Lang } from '@/i18n'
import type { Block, TableColumn, BlockStyle, StyleAlign } from './types'
import { buildTemplateContext, type ImageResolver } from './context'
import type { DocumentTemplateDefinition } from './types'
import { evaluateCondition } from './conditions'
import { interpolate, resolveDisplay, resolveCollection, type ScopeStack } from './resolvePath'
import { SIZE_PT, HEADING_SIZE, colorHex, sizePt, isBold, alignOf, colorOf } from './style'

export interface RenderDocxArgs {
  definition: DocumentTemplateDefinition
  quotation:  Quotation
  tenant:     TenantProfile
  texts:      TenantText[]
  lang:       Lang
  images?:    ImageResolver
}

const ALIGN: Record<StyleAlign, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left:   AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right:  AlignmentType.RIGHT,
}

// docx sizes are in half-points; our SIZE_PT table is in points.
const hp = (pt: number) => Math.round(pt * 2)

export async function renderTemplateToDocx(args: RenderDocxArgs): Promise<Uint8Array> {
  const ctx = buildTemplateContext(args.quotation, args.tenant, args.texts, args.lang, args.images)
  const body: (Paragraph | Table)[] = []

  function run(text: string, style?: BlockStyle, sizePtOverride?: number): TextRun {
    return new TextRun({
      text: text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' '),
      bold: isBold(style),
      size: hp(sizePtOverride ?? sizePt(style)),
      color: colorHex(colorOf(style)),
    })
  }

  function emit(blocks: Block[], scope: ScopeStack) {
    for (const block of blocks) {
      if (!evaluateCondition(block.visible, ctx, scope)) continue
      emitBlock(block, scope)
    }
  }

  function emitBlock(block: Block, scope: ScopeStack) {
    switch (block.kind) {
      case 'text': {
        body.push(new Paragraph({
          alignment: ALIGN[alignOf(block.style)],
          spacing: { after: 60 },
          children: [run(interpolate(block.content, ctx, scope), block.style)],
        }))
        break
      }
      case 'heading': {
        const pt = SIZE_PT[HEADING_SIZE[block.level]]
        body.push(new Paragraph({
          alignment: ALIGN[alignOf(block.style)],
          spacing: { before: 120, after: 80 },
          children: [run(interpolate(block.content, ctx, scope), { ...block.style, weight: 'bold' }, pt)],
        }))
        break
      }
      case 'key-value': {
        for (const row of block.rows) {
          body.push(new Paragraph({
            spacing: { after: 40 },
            children: [
              run(interpolate(row.label, ctx, scope) + ':  ', { ...block.style, weight: 'bold', color: 'muted' }),
              run(resolveDisplay(ctx, scope, row.value), block.style),
            ],
          }))
        }
        break
      }
      case 'line-items-table':
        body.push(buildTable(block.columns, scope))
        if (block.showSummary !== false) body.push(...summaryParagraphs())
        break
      case 'divider':
        body.push(new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D2D4D8', space: 1 } },
          spacing: { after: 120 },
          children: [],
        }))
        break
      case 'spacer':
        body.push(new Paragraph({ spacing: { before: hp(block.height), after: 0 }, children: [] }))
        break
      case 'repeater': {
        for (const frame of resolveCollection(ctx, scope, block.over)) emit(block.children, [...scope, frame])
        break
      }
      case 'group':
        emit(block.children, scope)
        break
      case 'image':
        // Logo/image embedding is intentionally omitted in v1 DOCX (mirrors the
        // PDF binding-image limitation): fall back to the tenant name as text.
        if (block.source === 'tenant_logo' && ctx.tenant.name) {
          body.push(new Paragraph({ children: [run(ctx.tenant.name, { weight: 'bold', size: 'lg' }, SIZE_PT.lg)] }))
        }
        break
    }
  }

  function buildTable(columns: TableColumn[], scope: ScopeStack): Table {
    const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0)
    const pct = columns.map(c => Math.round((100 * (c.width ?? 1)) / totalWeight))

    const header = new TableRow({
      children: columns.map((c, i) => new TableCell({
        width: { size: pct[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: ALIGN[c.align ?? 'left'],
          children: [run(interpolate(c.header, ctx, scope), { weight: 'bold', color: 'muted', size: 'sm' })],
        })],
      })),
    })

    const rows = resolveCollection(ctx, scope, 'quotation.line_items').map(frame => {
      const rowScope: ScopeStack = [...scope, frame]
      return new TableRow({
        children: columns.map((c, i) => new TableCell({
          width: { size: pct[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: ALIGN[c.align ?? 'left'],
            children: [run(resolveDisplay(ctx, rowScope, c.value), { size: 'sm' })],
          })],
        })),
      })
    })

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })
  }

  function summaryParagraphs(): Paragraph[] {
    const cur = ctx.currency
    const line = (lbl: string, amount: string, bold = false) => new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 40 },
      children: [
        run(`${lbl}:  `, { weight: bold ? 'bold' : 'normal', color: bold ? 'ink' : 'muted', size: 'sm' }),
        run(amount, { weight: bold ? 'bold' : 'normal', color: bold ? 'accent' : 'ink', size: 'sm' }),
      ],
    })
    return [
      line(label('Subtotal', 'Međuzbir'), `${ctx.quotation.subtotal.toFixed(2)} ${cur}`),
      line(label('Total', 'Ukupno'), `${ctx.quotation.total.toFixed(2)} ${cur}`, true),
    ]
  }

  function label(en: string, sr: string): string {
    return args.lang === 'en' ? en : sr
  }

  emit(args.definition.blocks ?? [], [])

  const doc = new Document({
    sections: [{ properties: {}, children: body.length ? body : [new Paragraph({ children: [] })] }],
  })
  // Packer.toBlob is browser-safe; toBuffer relies on a Node Buffer and throws
  // "nodebuffer is not supported by this platform" in the browser. Mirrors the
  // existing quotationDocx.ts / quotationTechSpecDocx.ts generators.
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}
