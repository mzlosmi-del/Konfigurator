import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  AlignmentType, BorderStyle,
  PageBreak, PageNumber, Footer,
  Bookmark, InternalHyperlink,
  Table, TableRow, TableCell, WidthType,
} from 'docx'
import type {
  Quotation, TenantText, QuotationLineItem, QuotationConfigItem,
  VisualizationAsset,
} from '@/types/database'
import { type TenantProfile, labelsFor, loadLogoBytes } from './pdf/shared'
import { resolveText } from './texts'
import type { OutputLang } from '@/lib/languages'

type Lang = OutputLang

export interface BuildTechSpecArgs {
  tenant:    TenantProfile
  quotation: Quotation
  /** Pre-fetched `tenant_texts` rows. The builder reads the
   *  `specification` slot at product / characteristic / characteristic_value
   *  levels. */
  texts:     TenantText[]
  /** Every `asset_type = 'image'` row for the products on the quotation.
   *  Product images: `characteristic_value_id IS NULL`. Value images:
   *  `characteristic_value_id = <value.id>`. */
  assets:    VisualizationAsset[]
  lang:      Lang
}

// ── Palette / typography (mirrors quotationDocx.ts for visual consistency) ─
const HEX = {
  ink:       '151928',
  muted:     '6C7179',
  faint:     'ADB1B7',
  accent:    '154BE4',
  rule:      'D2D4D8',
  cardBg:    'F4F5F7',
}

const SZ = {
  cover_title:    88, // 44pt
  cover_subtitle: 32, // 16pt
  cover_meta:     22, // 11pt
  h1:             48, // 24pt
  h2:             32, // 16pt
  h3:             26, // 13pt
  body:           22, // 11pt
  small:          18, // 9pt
  footer:         16, // 8pt
}

const FONT = 'Noto Sans'

interface TechSpecLabels {
  title: string
  toc: string
  refNumber: string
  customer: string
  preparedFor: string
  preparedBy: string
  createdOn: string
  pageOf: { page: string; of: string }
}

const TS_LABELS: Record<Lang, TechSpecLabels> = {
  en: {
    title: 'Technical Specification',
    toc: 'Table of Contents',
    refNumber: 'Reference',
    customer: 'Customer',
    preparedFor: 'Prepared for',
    preparedBy: 'Prepared by',
    createdOn: 'Created on',
    pageOf: { page: 'Page', of: 'of' },
  },
  sr: {
    title: 'Tehnička specifikacija',
    toc: 'Sadržaj',
    refNumber: 'Referenca',
    customer: 'Kupac',
    preparedFor: 'Pripremljeno za',
    preparedBy: 'Pripremio',
    createdOn: 'Datum izrade',
    pageOf: { page: 'Strana', of: 'od' },
  },
  de: {
    title: 'Technische Spezifikation',
    toc: 'Inhaltsverzeichnis',
    refNumber: 'Referenz',
    customer: 'Kunde',
    preparedFor: 'Erstellt für',
    preparedBy: 'Erstellt von',
    createdOn: 'Erstellt am',
    pageOf: { page: 'Seite', of: 'von' },
  },
  fr: {
    title: 'Spécification technique',
    toc: 'Table des matières',
    refNumber: 'Référence',
    customer: 'Client',
    preparedFor: 'Préparé pour',
    preparedBy: 'Préparé par',
    createdOn: 'Créé le',
    pageOf: { page: 'Page', of: 'sur' },
  },
  es: {
    title: 'Especificación técnica',
    toc: 'Índice',
    refNumber: 'Referencia',
    customer: 'Cliente',
    preparedFor: 'Preparado para',
    preparedBy: 'Preparado por',
    createdOn: 'Creado el',
    pageOf: { page: 'Página', of: 'de' },
  },
  ru: {
    title: 'Техническая спецификация',
    toc: 'Содержание',
    refNumber: 'Номер',
    customer: 'Заказчик',
    preparedFor: 'Подготовлено для',
    preparedBy: 'Подготовил',
    createdOn: 'Дата создания',
    pageOf: { page: 'Стр.', of: 'из' },
  },
}

/** Safe accessor — tech-spec labels for `lang`, falling back to English. */
function tsLabels(lang: Lang): TechSpecLabels {
  return TS_LABELS[lang] ?? TS_LABELS.en
}

// ── Tiny paragraph helpers ──────────────────────────────────────────────────

function txt(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    bold:    opts.bold,
    size:    opts.size,
    color:   opts.color,
    italics: opts.italics,
    font:    FONT,
  })
}

interface ParaOpts {
  align?:         (typeof AlignmentType)[keyof typeof AlignmentType]
  spacingBefore?: number
  spacingAfter?:  number
  lineSpacing?:   number
  indent?:        number
  heading?:       (typeof HeadingLevel)[keyof typeof HeadingLevel]
}

function p(children: TextRun[], opts: ParaOpts = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    heading:   opts.heading,
    indent:    opts.indent ? { left: opts.indent } : undefined,
    spacing: {
      before:   opts.spacingBefore ?? 0,
      after:    opts.spacingAfter  ?? 0,
      line:     opts.lineSpacing,
      lineRule: opts.lineSpacing ? 'auto' : undefined,
    },
    children,
  })
}

function blank(before = 120): Paragraph {
  return new Paragraph({ spacing: { before, after: 0 }, children: [] })
}

function fmtDate(date: Date, lang: Lang): string {
  return date.toLocaleDateString(labelsFor(lang).dateLocale, { dateStyle: 'long' })
}

// ── Spec resolver (single slot lookup with EN/SR fallback) ─────────────────

function resolveSpec(
  texts: TenantText[],
  level: 'product' | 'characteristic' | 'characteristic_value',
  referenceId: string,
  lang: Lang,
): string {
  // Try requested language first, then the other.
  return resolveText(texts, level, referenceId, 'specification', lang)
}

function specParagraphs(content: string): Paragraph[] {
  if (!content.trim()) return []
  return content.split(/\r?\n/).flatMap(line => {
    const trimmed = line.trim()
    if (!trimmed) return []
    // 264 = 1.1 line spacing — tight executive density without feeling cramped.
    // 80 = 4pt paragraph spacing — clear separation between bullets/lines.
    return [p([txt(line, { size: SZ.body, color: HEX.ink })], { lineSpacing: 264, spacingAfter: 80, align: AlignmentType.BOTH })]
  })
}

// ── Image embedding ─────────────────────────────────────────────────────────

// Standard image canvas (px at 96 DPI). All images render fitted into this
// box with proportional aspect ratio AND upscaling allowed — so a thumbnail
// uploaded by the admin appears at the same visual weight as a full-size
// render. This is the executive-doc convention: every figure looks like a
// uniform plate, not a random collage of asset sizes.
const IMG_TARGET_W   = 480 // ~5" — comfortable on A4 with 0.75" side margins
const IMG_TARGET_H   = 320 // ~3.3" — caps tall portraits so they don't dominate
const IMG_PAIR_W     = 330 // per-image max width when two share a row (~3.4")
const IMG_PAIR_H     = 280 // per-image max height in a 2-up row
const IMAGES_PER_ROW = 2   // cap at 2; at 3 per row each slot is too narrow (~213px)

function fitImage(
  natW: number, natH: number,
  maxW = IMG_TARGET_W, maxH = IMG_TARGET_H,
): { width: number; height: number } {
  if (natW <= 0 || natH <= 0) {
    return { width: maxW, height: Math.round(maxW * 2 / 3) }
  }
  const ratio = Math.min(maxW / natW, maxH / natH)
  return {
    width:  Math.round(natW * ratio),
    height: Math.round(natH * ratio),
  }
}

const NIL_BORDER = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }

async function imagesRowElements(assets: VisualizationAsset[]): Promise<(Paragraph | Table)[]> {
  const ordered = [...assets].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })

  // Load all in parallel — avoids the sequential latency of the old for-loop.
  const loaded = await Promise.all(ordered.map(a => loadLogoBytes(a.url)))
  const valid  = loaded.filter((x): x is NonNullable<typeof x> => x !== null)
  if (valid.length === 0) return []

  const elements: (Paragraph | Table)[] = []

  for (let i = 0; i < valid.length; i += IMAGES_PER_ROW) {
    const chunk = valid.slice(i, i + IMAGES_PER_ROW)

    if (chunk.length === 1) {
      // Single image — full-width slot, same as the original behaviour.
      const { width, height } = fitImage(chunk[0].width, chunk[0].height)
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 100 },
        children: [new ImageRun({
          data: chunk[0].bytes,
          type: chunk[0].extension,
          transformation: { width, height },
        } as unknown as ConstructorParameters<typeof ImageRun>[0])],
      }))
    } else {
      // Two images — borderless table so both cells top-align independently
      // of their heights (inline siblings in one paragraph would baseline-align).
      elements.push(new Table({
        width:   { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: NIL_BORDER, bottom: NIL_BORDER, left: NIL_BORDER, right: NIL_BORDER, insideHorizontal: NIL_BORDER, insideVertical: NIL_BORDER },
        rows: [new TableRow({
          children: chunk.map(img => {
            const { width, height } = fitImage(img.width, img.height, IMG_PAIR_W, IMG_PAIR_H)
            return new TableCell({
              borders: { top: NIL_BORDER, bottom: NIL_BORDER, left: NIL_BORDER, right: NIL_BORDER },
              margins: { top: 80, bottom: 100 },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({
                  data: img.bytes,
                  type: img.extension,
                  transformation: { width, height },
                } as unknown as ConstructorParameters<typeof ImageRun>[0])],
              })],
            })
          }),
        })],
      }))
    }
  }

  return elements
}

// ── Builder ────────────────────────────────────────────────────────────────

export async function buildQuotationTechSpecDocxBytes(args: BuildTechSpecArgs): Promise<Uint8Array> {
  const { tenant, quotation, texts, assets, lang } = args
  const L = tsLabels(lang)
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]

  // Partition images for fast O(1) lookup per product / value.
  const productImages: Record<string, VisualizationAsset[]> = {}
  const valueImages:   Record<string, VisualizationAsset[]> = {}
  for (const a of assets) {
    if (a.characteristic_value_id) {
      (valueImages[a.characteristic_value_id] ??= []).push(a)
    } else {
      (productImages[a.product_id] ??= []).push(a)
    }
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  // Embed the logo whenever `loadLogoBytes` returns *any* bytes. The previous
  // version gated on `width > 0 && height > 0`, but the in-browser dimension
  // probe (`new Image()` on a blob URL) silently returns 0×0 for some image
  // payloads, which dropped the logo entirely and fell through to a text
  // fallback. When we don't know the natural size we fall back to the max
  // bounding box — Word/LibreOffice/Pages all happily render it.
  const logo  = await loadLogoBytes(tenant.logo_url)
  const LOGO_MAX_W = 320
  const LOGO_MAX_H = 130
  const coverChildren: Paragraph[] = []

  if (logo) {
    const hasDims = logo.width > 0 && logo.height > 0
    const ratio   = hasDims ? Math.min(LOGO_MAX_W / logo.width, LOGO_MAX_H / logo.height, 1) : 1
    const w       = hasDims ? Math.max(60, logo.width  * ratio) : LOGO_MAX_W
    const h       = hasDims ? Math.max(60, logo.height * ratio) : LOGO_MAX_H
    coverChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 480 },
      children: [new ImageRun({
        data: logo.bytes,
        type: logo.extension,
        transformation: { width: w, height: h },
      } as unknown as ConstructorParameters<typeof ImageRun>[0])],
    }))
  } else {
    // No logo URL set on the tenant, or the fetch failed entirely — fall back
    // to the tenant name as the cover mark.
    coverChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 480 },
      children: [txt(tenant.name.toUpperCase(), { bold: true, size: 36, color: HEX.ink })],
    }))
  }

  // Big title
  coverChildren.push(p(
    [txt(L.title, { bold: true, size: SZ.cover_title, color: HEX.accent })],
    { align: AlignmentType.CENTER, spacingAfter: 280 },
  ))

  // Customer + reference
  if (quotation.customer_name) {
    coverChildren.push(p(
      [
        txt(`${L.preparedFor}: `, { size: SZ.cover_subtitle, color: HEX.muted }),
        txt(quotation.customer_name,  { bold: true, size: SZ.cover_subtitle, color: HEX.ink }),
      ],
      { align: AlignmentType.CENTER, spacingAfter: 80 },
    ))
  }
  if (quotation.reference_number) {
    coverChildren.push(p(
      [
        txt(`${L.refNumber}: `,           { size: SZ.cover_meta, color: HEX.muted }),
        txt(quotation.reference_number,    { size: SZ.cover_meta, color: HEX.ink }),
      ],
      { align: AlignmentType.CENTER, spacingAfter: 60 },
    ))
  }
  coverChildren.push(p(
    [
      txt(`${L.createdOn}: `,         { size: SZ.cover_meta, color: HEX.muted }),
      txt(fmtDate(new Date(), lang),  { size: SZ.cover_meta, color: HEX.ink }),
    ],
    { align: AlignmentType.CENTER, spacingAfter: 60 },
  ))

  // Tenant strip near the bottom — boxed shading for an executive feel.
  const tenantStripLines: string[] = []
  const senderParts = [
    tenant.contact_person,
    tenant.company_address,
    tenant.company_phone,
    tenant.company_email,
    tenant.company_website,
  ].filter((v): v is string => !!v && v.trim().length > 0)
  if (senderParts.length > 0) tenantStripLines.push(senderParts.join('  ·  '))
  const regBits = [
    tenant.vat_number          ? `VAT: ${tenant.vat_number}` : null,
    tenant.company_reg_number  ? `Reg: ${tenant.company_reg_number}` : null,
  ].filter((v): v is string => !!v)
  if (regBits.length > 0) tenantStripLines.push(regBits.join('   '))

  // Push the tenant strip to the bottom: large spacing before, smaller after.
  coverChildren.push(new Paragraph({
    spacing: { before: 4800, after: 60 },
    children: [],
  }))
  coverChildren.push(p(
    [txt(tenant.name.toUpperCase(), { bold: true, size: SZ.cover_meta, color: HEX.ink })],
    { align: AlignmentType.CENTER, spacingAfter: 60 },
  ))
  for (const line of tenantStripLines) {
    coverChildren.push(p(
      [txt(line, { size: SZ.small, color: HEX.muted })],
      { align: AlignmentType.CENTER, spacingAfter: 40 },
    ))
  }
  coverChildren.push(new Paragraph({ children: [new PageBreak()] }))

  // ── Pre-walk: keep only chapters that actually have content ─────────────
  // A chapter "has content" when its spec text is non-empty OR it has at
  // least one image attached. Empty chapters — no text and no pictures —
  // are dropped entirely (no heading rendered). Products that have no own
  // content but still host one or more surviving children keep their
  // heading so the children have a parent in the numbering scheme.
  interface SurvivingChild {
    entry:          QuotationConfigItem
    charSpec:       string
    valueSpec:      string
    hasValueImages: boolean
  }
  interface SurvivingProduct {
    item:             QuotationLineItem
    productSpec:      string
    hasProductImages: boolean
    children:         SurvivingChild[]
  }

  const survivors: SurvivingProduct[] = []
  for (const item of items) {
    const productSpec      = resolveSpec(texts, 'product', item.product_id, lang)
    const hasProductImages = (productImages[item.product_id]?.length ?? 0) > 0
    const hasOwnContent    = productSpec.trim().length > 0 || hasProductImages

    const cfg = Array.isArray(item.configuration) ? item.configuration : []
    const children: SurvivingChild[] = []
    for (const entry of cfg as QuotationConfigItem[]) {
      const charSpec       = resolveSpec(texts, 'characteristic',       entry.characteristic_id, lang)
      const valueSpec      = resolveSpec(texts, 'characteristic_value', entry.value_id,          lang)
      const hasValueImages = (valueImages[entry.value_id]?.length ?? 0) > 0
      if (charSpec.trim() || valueSpec.trim() || hasValueImages) {
        children.push({ entry, charSpec, valueSpec, hasValueImages })
      }
    }

    if (hasOwnContent || children.length > 0) {
      survivors.push({ item, productSpec, hasProductImages, children })
    }
  }

  // ── TOC entries from surviving structure (renumbered consecutively) ─────
  interface TocEntry { level: 1 | 2; number: string; title: string; bookmarkId: string }
  const tocEntries: TocEntry[] = []
  survivors.forEach((s, i) => {
    const productNum = i + 1
    tocEntries.push({
      level:      1,
      number:     `${productNum}`,
      title:      s.item.product_name,
      bookmarkId: `ch-${productNum}`,
    })
    s.children.forEach((c, j) => {
      const charIndex = j + 1
      tocEntries.push({
        level:      2,
        number:     `${productNum}.${charIndex}`,
        title:      c.entry.value_label ? `${c.entry.characteristic_name}: ${c.entry.value_label}` : c.entry.characteristic_name,
        bookmarkId: `ch-${productNum}-${charIndex}`,
      })
    })
  })

  // ── Table of contents page (static, with click-through bookmarks) ────────
  const tocChildren: Paragraph[] = [
    p([txt(L.toc, { bold: true, size: SZ.h1, color: HEX.ink })],
      { spacingBefore: 200, spacingAfter: 240 }),
    ...tocEntries.map(entry => new Paragraph({
      spacing: { after: 40, line: 264, lineRule: 'auto' },
      indent:  entry.level === 2 ? { left: 480 } : undefined,
      children: [new InternalHyperlink({
        anchor:   entry.bookmarkId,
        children: [
          new TextRun({
            text:  `${entry.number}. ${entry.title}`,
            font:  FONT,
            size:  entry.level === 1 ? SZ.body + 2 : SZ.body,
            bold:  entry.level === 1,
            color: HEX.ink,
          }),
        ],
      })],
    })),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  // ── Body chapters (matching the surviving structure) ────────────────────
  const bodyChildren: (Paragraph | Table)[] = []

  for (let i = 0; i < survivors.length; i++) {
    const s          = survivors[i]
    const productNum = i + 1
    // H1: subtle 1.5pt rule under the chapter title — clean executive section break.
    bodyChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: i === 0 ? 80 : 360, after: 100 },
      border:  { bottom: { style: BorderStyle.SINGLE, size: 6, color: HEX.rule, space: 4 } },
      children: [new Bookmark({
        id: `ch-${productNum}`,
        children: [txt(`${productNum}. ${s.item.product_name}`, { bold: true, size: SZ.h1, color: HEX.ink })],
      })],
    }))

    bodyChildren.push(...specParagraphs(s.productSpec))
    if (s.hasProductImages) {
      bodyChildren.push(...(await imagesRowElements(productImages[s.item.product_id] ?? [])))
    }

    for (let j = 0; j < s.children.length; j++) {
      const c             = s.children[j]
      const charIndex     = j + 1
      const chapterNumber = `${productNum}.${charIndex}`
      const combinedTitle = c.entry.value_label ? `${c.entry.characteristic_name}: ${c.entry.value_label}` : c.entry.characteristic_name
      bodyChildren.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 80 },
        children: [new Bookmark({
          id: `ch-${productNum}-${charIndex}`,
          children: [txt(`${chapterNumber}. ${combinedTitle}`, { bold: true, size: SZ.h2, color: HEX.ink })],
        })],
      }))

      bodyChildren.push(...specParagraphs(c.charSpec))
      bodyChildren.push(...specParagraphs(c.valueSpec))
      if (c.hasValueImages) {
        bodyChildren.push(...(await imagesRowElements(valueImages[c.entry.value_id] ?? [])))
      }
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerLabel = (tenant.pdf_footer ?? '').trim() || tenant.name
  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: HEX.rule } },
        spacing: { after: 60 },
        children: [],
      }),
      new Paragraph({
        tabStops: [
          { type: 'center', position: 5160 },
          { type: 'right',  position: 10320 },
        ],
        children: [
          txt(L.title, { size: SZ.footer, color: HEX.muted }),
          txt('\t', { size: SZ.footer }),
          txt(`${L.pageOf.page} `, { size: SZ.footer, color: HEX.muted }),
          new TextRun({ children: [PageNumber.CURRENT],     size: SZ.footer, color: HEX.muted, font: FONT }),
          txt(` ${L.pageOf.of} `, { size: SZ.footer, color: HEX.muted }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SZ.footer, color: HEX.muted, font: FONT }),
          txt('\t', { size: SZ.footer }),
          txt(footerLabel, { size: SZ.footer, color: HEX.faint }),
        ],
      }),
    ],
  })

  // ── Document ──────────────────────────────────────────────────────────────
  // Three sections: cover (no footer), TOC, body (with footer + page numbers).
  // The TOC is built statically with InternalHyperlinks to Bookmarks on the
  // chapter headings, so it always renders without needing Word to update
  // fields on open.
  const headingRunStyle = (size: number) => ({ bold: true, size, color: HEX.ink, font: FONT })
  const doc = new Document({
    creator: tenant.name,
    title:   `${L.title} — ${quotation.reference_number ?? ''}`.trim(),
    styles: {
      default: {
        // 264 line + 80 after by default — every paragraph inherits the
        // tight executive rhythm unless it explicitly overrides.
        document: {
          run:       { font: FONT, size: SZ.body },
          paragraph: { spacing: { line: 264, lineRule: 'auto', after: 80 } },
        },
        heading1: { run: headingRunStyle(SZ.h1), paragraph: { spacing: { before: 360, after: 100 } } },
        heading2: { run: headingRunStyle(SZ.h2), paragraph: { spacing: { before: 220, after: 80 } } },
      },
    },
    sections: [
      // Cover — no footer, no page number.
      {
        properties: {
          page: {
            size:   { width: 11906, height: 16838 },
            margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
          },
        },
        children: coverChildren,
      },
      // TOC page
      {
        properties: {
          page: {
            size:   { width: 11906, height: 16838 },
            margin: { top: 720, bottom: 1080, left: 720, right: 720, footer: 360 },
          },
        },
        footers: { default: footer },
        children: tocChildren,
      },
      // Body
      {
        properties: {
          page: {
            size:   { width: 11906, height: 16838 },
            margin: { top: 720, bottom: 1080, left: 720, right: 720, footer: 360 },
          },
        },
        footers: { default: footer },
        children: bodyChildren.length > 0 ? bodyChildren : [blank()],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

export function openTechSpecDocxBlob(bytes: Uint8Array, filename = 'tech-spec.docx') {
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

