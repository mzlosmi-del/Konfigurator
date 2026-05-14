import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  AlignmentType, BorderStyle,
  PageBreak, PageNumber, Footer,
  Bookmark, InternalHyperlink,
} from 'docx'
import type {
  Quotation, TenantText, QuotationLineItem, QuotationConfigItem,
  VisualizationAsset,
} from '@/types/database'
import { type TenantProfile, loadLogoBytes, PDF_LABELS } from './pdf/shared'
import { resolveText } from './texts'

type Lang = 'en' | 'sr'

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

const TS_LABELS: Record<Lang, {
  title: string
  toc: string
  refNumber: string
  customer: string
  preparedFor: string
  preparedBy: string
  createdOn: string
  pageOf: { page: string; of: string }
}> = {
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
  return date.toLocaleDateString(PDF_LABELS[lang].dateLocale, { dateStyle: 'long' })
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
    return [p([txt(line, { size: SZ.body, color: HEX.ink })], { lineSpacing: 320, spacingAfter: 60 })]
  })
}

// ── Image embedding ─────────────────────────────────────────────────────────

const MAX_IMG_W = 480 // pt — keeps the image well clear of the A4 margin
const MAX_IMG_H = 360

async function imageParagraph(url: string): Promise<Paragraph | null> {
  const loaded = await loadLogoBytes(url) // reuses generic loader
  if (!loaded || loaded.width === 0 || loaded.height === 0) return null
  const ratio = Math.min(MAX_IMG_W / loaded.width, MAX_IMG_H / loaded.height, 1)
  const w = Math.max(40, loaded.width  * ratio)
  const h = Math.max(40, loaded.height * ratio)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 160 },
    children: [new ImageRun({
      data: loaded.bytes,
      type: loaded.extension,
      transformation: { width: w, height: h },
    } as unknown as ConstructorParameters<typeof ImageRun>[0])],
  })
}

async function imagesForAssets(assets: VisualizationAsset[]): Promise<Paragraph[]> {
  const ordered = [...assets].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const paragraphs: Paragraph[] = []
  for (const asset of ordered) {
    const para = await imageParagraph(asset.url)
    if (para) paragraphs.push(para)
  }
  return paragraphs
}

// ── Builder ────────────────────────────────────────────────────────────────

export async function buildQuotationTechSpecDocxBytes(args: BuildTechSpecArgs): Promise<Uint8Array> {
  const { tenant, quotation, texts, assets, lang } = args
  const L = TS_LABELS[lang]
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
      spacing: { before: 720, after: 600 },
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
      spacing: { before: 720, after: 600 },
      children: [txt(tenant.name.toUpperCase(), { bold: true, size: 36, color: HEX.ink })],
    }))
  }

  // Big title
  coverChildren.push(p(
    [txt(L.title, { bold: true, size: SZ.cover_title, color: HEX.accent })],
    { align: AlignmentType.CENTER, spacingAfter: 400 },
  ))

  // Customer + reference
  if (quotation.customer_name) {
    coverChildren.push(p(
      [
        txt(`${L.preparedFor}: `, { size: SZ.cover_subtitle, color: HEX.muted }),
        txt(quotation.customer_name,  { bold: true, size: SZ.cover_subtitle, color: HEX.ink }),
      ],
      { align: AlignmentType.CENTER, spacingAfter: 120 },
    ))
  }
  if (quotation.reference_number) {
    coverChildren.push(p(
      [
        txt(`${L.refNumber}: `,           { size: SZ.cover_meta, color: HEX.muted }),
        txt(quotation.reference_number,    { size: SZ.cover_meta, color: HEX.ink }),
      ],
      { align: AlignmentType.CENTER, spacingAfter: 80 },
    ))
  }
  coverChildren.push(p(
    [
      txt(`${L.createdOn}: `,         { size: SZ.cover_meta, color: HEX.muted }),
      txt(fmtDate(new Date(), lang),  { size: SZ.cover_meta, color: HEX.ink }),
    ],
    { align: AlignmentType.CENTER, spacingAfter: 80 },
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

  // ── Pre-walk to build TOC entries + match bookmark ids on body headings ──
  // Two levels only: product (1.) and characteristic+value (1.1.). The
  // bookmark id is the same chapter number with `-` separators so we can
  // link to it from the TOC.
  interface TocEntry { level: 1 | 2; number: string; title: string; bookmarkId: string }
  const tocEntries: TocEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const item       = items[i]
    const productNum = i + 1
    tocEntries.push({
      level:      1,
      number:     `${productNum}`,
      title:      item.product_name,
      bookmarkId: `ch-${productNum}`,
    })
    const cfg = Array.isArray(item.configuration) ? item.configuration : []
    cfg.forEach((entry: QuotationConfigItem, j) => {
      const charIndex = j + 1
      tocEntries.push({
        level:      2,
        number:     `${productNum}.${charIndex}`,
        title:      `${entry.characteristic_name}: ${entry.value_label}`,
        bookmarkId: `ch-${productNum}-${charIndex}`,
      })
    })
  }

  // ── Table of contents page (static, with click-through bookmarks) ────────
  const tocChildren: Paragraph[] = [
    p([txt(L.toc, { bold: true, size: SZ.h1, color: HEX.ink })],
      { spacingBefore: 240, spacingAfter: 320 }),
    ...tocEntries.map(entry => new Paragraph({
      spacing: { after: 60 },
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

  // ── Body chapters ─────────────────────────────────────────────────────────
  // Two levels: product (Heading 1) and characteristic + value combined
  // (Heading 2). Each chapter heading wraps its text in a Bookmark whose id
  // matches the TOC entry, so the TOC's InternalHyperlinks jump to it.
  const bodyChildren: Paragraph[] = []

  for (let i = 0; i < items.length; i++) {
    const item       = items[i]
    const productNum = i + 1
    const productEntry = tocEntries.find(e => e.level === 1 && e.number === `${productNum}`)!
    bodyChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: i === 0 ? 200 : 480, after: 160 },
      children: [new Bookmark({
        id: productEntry.bookmarkId,
        children: [txt(`${productNum}. ${item.product_name}`, { bold: true, size: SZ.h1, color: HEX.ink })],
      })],
    }))

    // Product spec text
    const productSpec = resolveSpec(texts, 'product', item.product_id, lang)
    bodyChildren.push(...specParagraphs(productSpec))

    // Product images
    const pAssets = productImages[item.product_id] ?? []
    bodyChildren.push(...(await imagesForAssets(pAssets)))

    // Characteristic + value combined subsections (single Heading 2 per pair)
    const cfg = Array.isArray(item.configuration) ? item.configuration : []
    for (let j = 0; j < cfg.length; j++) {
      const entry     = cfg[j] as QuotationConfigItem
      const charIndex = j + 1
      const chapterNumber = `${productNum}.${charIndex}`
      const combinedTitle = `${entry.characteristic_name}: ${entry.value_label}`
      const subEntry = tocEntries.find(e => e.level === 2 && e.number === chapterNumber)!
      bodyChildren.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [new Bookmark({
          id: subEntry.bookmarkId,
          children: [txt(`${chapterNumber}. ${combinedTitle}`, { bold: true, size: SZ.h2, color: HEX.ink })],
        })],
      }))

      // Characteristic spec text first, value spec text second.
      const charSpec  = resolveSpec(texts, 'characteristic',       entry.characteristic_id, lang)
      const valueSpec = resolveSpec(texts, 'characteristic_value', entry.value_id,          lang)
      bodyChildren.push(...specParagraphs(charSpec))
      bodyChildren.push(...specParagraphs(valueSpec))

      // Value images (characteristic-level images still out of scope).
      const vAssets = valueImages[entry.value_id] ?? []
      bodyChildren.push(...(await imagesForAssets(vAssets)))
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
        document: { run: { font: FONT, size: SZ.body } },
        heading1: { run: headingRunStyle(SZ.h1), paragraph: { spacing: { before: 360, after: 160 } } },
        heading2: { run: headingRunStyle(SZ.h2), paragraph: { spacing: { before: 280, after: 120 } } },
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

