// Generic DOCX renderer: walks the same block tree as renderPdf.ts and emits a
// Word document via the `docx` library. Brought to the quality bar of the
// hardcoded generators: Noto Sans throughout, A4 page setup, embedded images
// (logo + binding product/value images, fitted), an optional footer with page
// numbers, document-grade headings (H1 rule), justified / line-spaced text, and
// page breaks. Still walks the SAME tree against the SAME TemplateContext.

import {
  Document, Packer, Paragraph, TextRun, ImageRun, PageBreak, Footer, PageNumber,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
} from 'docx'
import type { Quotation, TenantText } from '@/types/database'
import { type TenantProfile, loadLogoBytes, getFooterLabel, PDF_LABELS } from '@/lib/pdf/shared'
import type { Lang } from '@/i18n'
import type { Block, TableColumn, BlockStyle, StyleAlign } from './types'
import { buildTemplateContext, type ImageResolver } from './context'
import type { DocumentTemplateDefinition } from './types'
import { evaluateCondition } from './conditions'
import { interpolate, resolveDisplay, resolveRaw, resolveCollection, type ScopeStack } from './resolvePath'
import { SIZE_PT, HEADING_SIZE, colorHex, sizePt, isBold, alignOf, colorOf, lineSpacingOf } from './style'
import { collectBindingImageUrls } from './collectImages'

const FONT = 'Noto Sans'

export interface RenderDocxArgs {
  definition: DocumentTemplateDefinition
  quotation:  Quotation
  tenant:     TenantProfile
  texts:      TenantText[]
  lang:       Lang
  images?:    ImageResolver
}

const ALIGN: Record<StyleAlign, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left:    AlignmentType.LEFT,
  center:  AlignmentType.CENTER,
  right:   AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

// docx sizes are in half-points; our SIZE_PT table is in points.
const hp = (pt: number) => Math.round(pt * 2)
// docx line spacing is in 240ths of a line; our presets are plain multipliers.
const lineTwips = (style?: BlockStyle) => Math.round(lineSpacingOf(style) * 240)

type LoadedImage = NonNullable<Awaited<ReturnType<typeof loadLogoBytes>>>

// Image target box (px @ 96dpi), mirroring quotationTechSpecDocx fitImage.
const IMG_MAX_W = 480
const IMG_MAX_H = 320
function fitImage(natW: number, natH: number, maxW: number, maxH: number) {
  if (natW <= 0 || natH <= 0) return { width: maxW, height: Math.round(maxW * 2 / 3) }
  const ratio = Math.min(maxW / natW, maxH / natH)
  return { width: Math.round(natW * ratio), height: Math.round(natH * ratio) }
}

export async function renderTemplateToDocx(args: RenderDocxArgs): Promise<Uint8Array> {
  const ctx = buildTemplateContext(args.quotation, args.tenant, args.texts, args.lang, args.images)
  const L = PDF_LABELS[args.lang]

  // ── Pre-pass: embed the logo + every binding image once (async). ──────────
  const logoLoaded = await loadLogoBytes(ctx.tenant.logo_url)
  const bindingImages = new Map<string, LoadedImage>()
  await Promise.all([...collectBindingImageUrls(args.definition.blocks ?? [], ctx)].map(async (url) => {
    const img = await loadLogoBytes(url)
    if (img) bindingImages.set(url, img)
  }))

  const body: (Paragraph | Table)[] = []

  function run(text: string, style?: BlockStyle, sizePtOverride?: number): TextRun {
    return new TextRun({
      text: text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' '),
      bold: isBold(style),
      size: hp(sizePtOverride ?? sizePt(style)),
      color: colorHex(colorOf(style)),
      font: FONT,
    })
  }

  function imageParagraph(img: LoadedImage, maxW: number, maxH: number): Paragraph {
    const { width, height } = fitImage(img.width, img.height, maxW, maxH)
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 120 },
      children: [new ImageRun({
        data: img.bytes,
        type: img.extension,
        transformation: { width, height },
      } as unknown as ConstructorParameters<typeof ImageRun>[0])],
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
          spacing: { after: 80, line: lineTwips(block.style), lineRule: 'auto' },
          children: [run(interpolate(block.content, ctx, scope), block.style)],
        }))
        break
      }
      case 'heading': {
        const pt = SIZE_PT[HEADING_SIZE[block.level]]
        body.push(new Paragraph({
          alignment: ALIGN[alignOf(block.style)],
          spacing: { before: block.level === 1 ? 240 : block.level === 2 ? 200 : 140, after: block.level === 1 ? 120 : 80 },
          // H1 carries a thin bottom rule, like the hardcoded tech-spec chapters.
          border: block.level === 1
            ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D2D4D8', space: 4 } }
            : undefined,
          children: [run(interpolate(block.content, ctx, scope), { ...block.style, weight: 'bold' }, pt)],
        }))
        break
      }
      case 'key-value': {
        for (const row of block.rows) {
          // Right tab stop so values align in a clean column.
          body.push(new Paragraph({
            spacing: { after: 40 },
            tabStops: [{ type: 'left', position: 2600 }],
            children: [
              run(interpolate(row.label, ctx, scope), { ...block.style, weight: 'bold', color: 'muted' }),
              run('\t', block.style),
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
      case 'page-break':
        body.push(new Paragraph({ children: [new PageBreak()] }))
        break
      case 'image': {
        if (block.source === 'tenant_logo') {
          if (logoLoaded) body.push(imageParagraph(logoLoaded, block.maxWidth ?? 200, block.maxHeight ?? 80))
          else if (ctx.tenant.name) body.push(new Paragraph({
            alignment: ALIGN[alignOf(block.style)],
            children: [run(ctx.tenant.name, { weight: 'bold', size: 'lg' }, SIZE_PT.lg)],
          }))
        } else if (block.source === 'binding' && block.binding) {
          const url = resolveRaw(ctx, scope, block.binding)
          const img = typeof url === 'string' ? bindingImages.get(url) : undefined
          if (img) body.push(imageParagraph(img, block.maxWidth ?? IMG_MAX_W, block.maxHeight ?? IMG_MAX_H))
        }
        break
      }
      case 'repeater': {
        const frames = resolveCollection(ctx, scope, block.over)
        frames.forEach((frame, i) => {
          if (block.pageBreakBefore && i > 0) body.push(new Paragraph({ children: [new PageBreak()] }))
          emit(block.children, [...scope, frame])
        })
        break
      }
      case 'group':
        emit(block.children, scope)
        break
    }
  }

  function buildTable(columns: TableColumn[], scope: ScopeStack): Table {
    const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0)
    const pct = columns.map(c => Math.round((100 * (c.width ?? 1)) / totalWeight))
    const headerRule = { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D2D4D8' } }

    const header = new TableRow({
      tableHeader: true,
      children: columns.map((c, i) => new TableCell({
        width: { size: pct[i], type: WidthType.PERCENTAGE },
        borders: headerRule,
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

  // ── Optional footer with page numbers ─────────────────────────────────────
  const wantFooter = args.definition.page?.footer
  const footerLabel = (args.definition.page?.footerLabel ?? '').trim()
    || getFooterLabel(args.tenant, args.tenant.name, args.texts, args.lang)
  const footer = wantFooter
    ? new Footer({
        children: [
          new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D2D4D8' } }, spacing: { after: 40 }, children: [] }),
          new Paragraph({
            tabStops: [{ type: 'right', position: 9300 }],
            children: [
              new TextRun({ text: footerLabel, size: hp(SIZE_PT.sm), color: colorHex('muted'), font: FONT }),
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({ text: `${L.page} `, size: hp(SIZE_PT.sm), color: colorHex('muted'), font: FONT }),
              new TextRun({ children: [PageNumber.CURRENT], size: hp(SIZE_PT.sm), color: colorHex('muted'), font: FONT }),
              new TextRun({ text: ` ${L.of} `, size: hp(SIZE_PT.sm), color: colorHex('muted'), font: FONT }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: hp(SIZE_PT.sm), color: colorHex('muted'), font: FONT }),
            ],
          }),
        ],
      })
    : undefined

  const doc = new Document({
    creator: args.tenant.name,
    styles: {
      default: {
        document: {
          run:       { font: FONT, size: hp(SIZE_PT.base) },
          paragraph: { spacing: { line: 312, lineRule: 'auto', after: 80 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size:   { width: 11906, height: 16838 }, // A4
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080, footer: 360 },
        },
      },
      footers: footer ? { default: footer } : undefined,
      children: body.length ? body : [new Paragraph({ children: [] })],
    }],
  })

  // Packer.toBlob is browser-safe; toBuffer relies on a Node Buffer and throws
  // "nodebuffer is not supported by this platform" in the browser.
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}
