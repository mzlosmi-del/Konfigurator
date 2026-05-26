// Generic PDF renderer: walks a DocumentTemplateDefinition block tree top-down
// and emits an A4 PDF via pdf-lib, reusing the font/logo/wrap/palette helpers
// from lib/pdf/shared.ts. Pagination follows the same `ensureSpace` / `y`-from-
// top idiom as the existing hardcoded templates (templateModern.ts).
//
// This is one of three generic renderers (renderDocx.ts, renderXlsx.ts) that
// all walk the SAME tree against the SAME TemplateContext built by context.ts.

import { PDFDocument, PDFPage, PDFFont } from 'pdf-lib'
import { C, wrapText, loadFonts, loadLogo, type TenantProfile, type EmbeddedImage } from '@/lib/pdf/shared'
import type { Quotation, TenantText } from '@/types/database'
import type { Lang } from '@/i18n'
import type {
  Block, DocumentTemplateDefinition, TableColumn, BlockStyle,
} from './types'
import { buildTemplateContext, type ImageResolver, type TemplateContext } from './context'
import { evaluateCondition } from './conditions'
import { interpolate, resolveDisplay, resolveRaw, resolveCollection, type ScopeStack } from './resolvePath'
import { SIZE_PT, HEADING_SIZE, COLOR_RGB, sizePt, isBold, alignOf, colorOf } from './style'

export interface RenderPdfArgs {
  definition: DocumentTemplateDefinition
  quotation:  Quotation
  tenant:     TenantProfile
  texts:      TenantText[]
  lang:       Lang
  images?:    ImageResolver
}

const W = 595, H = 842
const MX = 48
const FOOTER_BASELINE = 24
const MB = FOOTER_BASELINE + 36          // safe bottom threshold
const COL = W - MX * 2
const LINE_GAP = 4                        // extra pt between text lines

export async function renderTemplateToPdf(args: RenderPdfArgs): Promise<Uint8Array> {
  const ctx = buildTemplateContext(args.quotation, args.tenant, args.texts, args.lang, args.images)

  const pdfDoc = await PDFDocument.create()
  const { fontR, fontB } = await loadFonts(pdfDoc)
  const logoImg = await loadLogo(pdfDoc, ctx.tenant.logo_url)

  // Binding images (product / value) need async embedding, but the tree walk
  // below is synchronous. Pre-pass: collect every distinct binding-image URL
  // reachable in the tree (resolving image paths against every scope they can
  // appear in) and embed each once into a lookup map. renderImage then resolves
  // the binding to a URL and reads the embedded image from the map.
  const bindingImages = new Map<string, EmbeddedImage>()
  {
    const urls = collectBindingImageUrls(args.definition.blocks ?? [], ctx)
    await Promise.all([...urls].map(async (url) => {
      const img = await loadLogo(pdfDoc, url)   // loadLogo handles png/jpg + failures → null
      if (img) bindingImages.set(url, img)
    }))
  }

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = H - 48

  function newPage() {
    page = pdfDoc.addPage([W, H])
    y = H - 48
  }
  function ensureSpace(needed: number) {
    if (y - needed < MB) newPage()
  }
  function fontFor(style?: BlockStyle): PDFFont {
    return isBold(style) ? fontB : fontR
  }
  function colorFor(style?: BlockStyle) {
    return COLOR_RGB[colorOf(style)]
  }
  function drawAligned(str: string, size: number, font: PDFFont, color: ReturnType<typeof colorFor>, align: 'left' | 'center' | 'right', x0 = MX, x1 = W - MX) {
    const clean = str.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
    if (!clean.trim()) return
    const wTxt = font.widthOfTextAtSize(clean, size)
    let x = x0
    if (align === 'center') x = x0 + (x1 - x0 - wTxt) / 2
    else if (align === 'right') x = x1 - wTxt
    page.drawText(clean, { x, y, size, font, color })
  }

  // ── Block dispatch ──────────────────────────────────────────────────────
  function renderBlocks(blocks: Block[], scope: ScopeStack) {
    for (const block of blocks) {
      if (!evaluateCondition(block.visible, ctx, scope)) continue
      renderBlock(block, scope)
    }
  }

  function renderBlock(block: Block, scope: ScopeStack) {
    switch (block.kind) {
      case 'text':
      case 'heading': {
        const size = block.kind === 'heading' ? SIZE_PT[HEADING_SIZE[block.level]] : sizePt(block.style)
        const font = block.kind === 'heading' ? fontB : fontFor(block.style)
        const str  = interpolate(block.content, ctx, scope)
        const lines = wrapText(str, font, size, COL)
        for (const line of lines) {
          ensureSpace(size + LINE_GAP)
          y -= size
          drawAligned(line, size, font, colorFor(block.style), alignOf(block.style))
          y -= LINE_GAP
        }
        break
      }

      case 'key-value': {
        const size = sizePt(block.style)
        const labelW = COL * 0.34
        for (const row of block.rows) {
          const label = interpolate(row.label, ctx, scope)
          const value = resolveDisplay(ctx, scope, row.value)
          const valLines = wrapText(value, fontR, size, COL - labelW - 8)
          ensureSpace(Math.max(1, valLines.length) * (size + LINE_GAP))
          y -= size
          page.drawText(label.replace(/[\x00-\x1f\x7f]/g, ' '), { x: MX, y, size, font: fontB, color: C.muted })
          let vy = y
          for (const vl of valLines) {
            page.drawText(vl.replace(/[\x00-\x1f\x7f]/g, ' '), { x: MX + labelW, y: vy, size, font: fontR, color: C.ink })
            vy -= size + LINE_GAP
          }
          y = vy
        }
        break
      }

      case 'line-items-table':
        renderTable(block.columns, block.showSummary !== false, scope)
        break

      case 'image':
        renderImage(block.source, block.binding, block.maxWidth, block.maxHeight, scope)
        break

      case 'divider':
        ensureSpace(10)
        y -= 6
        page.drawLine({ start: { x: MX, y }, end: { x: W - MX, y }, thickness: 0.5, color: C.rule })
        y -= 6
        break

      case 'spacer':
        ensureSpace(block.height)
        y -= block.height
        break

      case 'repeater': {
        const frames = resolveCollection(ctx, scope, block.over)
        for (const frame of frames) {
          renderBlocks(block.children, [...scope, frame])
        }
        break
      }

      case 'group':
        renderBlocks(block.children, scope)
        break
    }
  }

  function renderTable(columns: TableColumn[], showSummary: boolean, scope: ScopeStack) {
    if (columns.length === 0) return
    const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0)
    const widths = columns.map(c => (COL * (c.width ?? 1)) / totalWeight)
    const xs: number[] = []
    let acc = MX
    for (const w of widths) { xs.push(acc); acc += w }
    const size = 9, rowH = 16

    // Header row
    ensureSpace(rowH + 4)
    y -= size
    columns.forEach((c, i) => {
      drawAligned(interpolate(c.header, ctx, scope), size, fontB, C.muted, c.align ?? 'left', xs[i], xs[i] + widths[i])
    })
    y -= 4
    page.drawLine({ start: { x: MX, y }, end: { x: W - MX, y }, thickness: 0.5, color: C.rule })
    y -= 6

    // Body — loops quotation.line_items
    const frames = resolveCollection(ctx, scope, 'quotation.line_items')
    frames.forEach((frame, idx) => {
      ensureSpace(rowH)
      if (idx % 2 === 1) {
        page.drawRectangle({ x: MX, y: y - rowH + 11, width: COL, height: rowH, color: C.rowAlt })
      }
      y -= size + 2
      const rowScope: ScopeStack = [...scope, frame]
      columns.forEach((c, i) => {
        const v = resolveDisplay(ctx, rowScope, c.value)
        // Truncate to a single line per cell to keep the grid tidy.
        const truncated = truncateToWidth(v, fontR, size, widths[i] - 4)
        drawAligned(truncated, size, fontR, C.ink, c.align ?? 'left', xs[i], xs[i] + widths[i])
      })
      y -= 6
    })

    if (showSummary) {
      y -= 2
      page.drawLine({ start: { x: MX + COL * 0.55, y }, end: { x: W - MX, y }, thickness: 0.5, color: C.rule })
      y -= 4
      const cur = ctx.currency
      const sumRow = (label: string, amount: string, bold = false) => {
        ensureSpace(rowH)
        y -= size
        drawAligned(label, size, bold ? fontB : fontR, bold ? C.ink : C.muted, 'left', MX + COL * 0.55, MX + COL * 0.78)
        drawAligned(amount, size, bold ? fontB : fontR, bold ? C.accent : C.ink, 'right', MX + COL * 0.78, W - MX)
        y -= 4
      }
      sumRow(label('Subtotal', 'Međuzbir'), `${ctx.quotation.subtotal.toFixed(2)} ${cur}`)
      sumRow(label('Total', 'Ukupno'), `${ctx.quotation.total.toFixed(2)} ${cur}`, true)
    }
  }

  function renderImage(source: 'tenant_logo' | 'binding', binding: string | undefined, maxW = 160, maxH = 60, scope: ScopeStack) {
    let img: EmbeddedImage | null = null
    if (source === 'tenant_logo') {
      img = logoImg
    } else if (source === 'binding' && binding) {
      const url = resolveRaw(ctx, scope, binding)
      if (typeof url === 'string' && url) img = bindingImages.get(url) ?? null
    }
    if (!img) {
      // Degrade gracefully: a missing logo falls back to the tenant name so the
      // document isn't blank where a brand mark would be. A missing binding
      // image (no URL, or fetch failed) simply renders nothing.
      if (source === 'tenant_logo' && ctx.tenant.name) {
        ensureSpace(SIZE_PT.lg + LINE_GAP)
        y -= SIZE_PT.lg
        page.drawText(ctx.tenant.name, { x: MX, y, size: SIZE_PT.lg, font: fontB, color: C.ink })
        y -= LINE_GAP
      }
      return
    }
    const dims = img.scaleToFit(maxW, maxH)
    ensureSpace(dims.height + 6)
    y -= dims.height
    page.drawImage(img, { x: MX, y, width: dims.width, height: dims.height })
    y -= 6
  }

  function label(en: string, sr: string): string {
    return args.lang === 'en' ? en : sr
  }

  renderBlocks(args.definition.blocks ?? [], [])
  return pdfDoc.save()
}

/** Trim a string with an ellipsis so it fits within maxWidth at the given size. */
function truncateToWidth(str: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = str.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean
  let lo = 0, hi = clean.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (font.widthOfTextAtSize(clean.slice(0, mid) + '…', size) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return clean.slice(0, lo) + '…'
}

/** Walk the block tree the same way the renderer does (entering repeaters and
 *  pushing scope frames) and collect every distinct URL referenced by a
 *  binding-sourced image block, so they can be embedded up front. */
function collectBindingImageUrls(blocks: Block[], ctx: TemplateContext): Set<string> {
  const urls = new Set<string>()
  const walk = (bs: Block[], scope: ScopeStack) => {
    for (const b of bs) {
      // Note: we ignore `visible` here — over-collecting a few URLs is harmless
      // and far cheaper than re-deriving visibility across all scope frames.
      if (b.kind === 'image' && b.source === 'binding' && b.binding) {
        const url = resolveRaw(ctx, scope, b.binding)
        if (typeof url === 'string' && url) urls.add(url)
      } else if (b.kind === 'repeater') {
        for (const frame of resolveCollection(ctx, scope, b.over)) walk(b.children, [...scope, frame])
      } else if (b.kind === 'group') {
        walk(b.children, scope)
      }
    }
  }
  walk(blocks, [])
  return urls
}

// Re-export so callers can build a context directly if needed.
export type { TemplateContext }
