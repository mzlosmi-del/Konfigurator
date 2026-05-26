import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'

// context.ts → quotations.ts → supabase.ts throws without env vars; mock it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { renderTemplateToPdf } from '@/lib/docTemplate/renderPdf'
import { renderTemplateToDocx } from '@/lib/docTemplate/renderDocx'
import { renderTemplateToXlsx } from '@/lib/docTemplate/renderXlsx'
import { makeSampleTemplate } from '@/lib/docTemplate/sampleTemplate'
import { TEMPLATE_PRESETS, makeTechSpecTemplate } from '@/lib/docTemplate/presets'
import type { ImageResolver } from '@/lib/docTemplate/context'
import type { DocumentTemplateDefinition } from '@/lib/docTemplate/types'
import { quotation, tenant, texts } from '@/__fixtures__/quotationFixture'

// 1×1 transparent PNG (matches the fixture's asset data URL) served for any
// non-font fetch so the image-embedding paths run end-to-end.
const PIXEL_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
), c => c.charCodeAt(0))

// pdf-lib's loadFonts fetch('/fonts/..') has no server in jsdom; serve the real
// font files from the public dir off disk instead.
const realFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/fonts/')) {
      const file = url.endsWith('Bold.ttf') ? 'NotoSans-Bold.ttf' : 'NotoSans-Regular.ttf'
      const bytes = readFileSync(resolve(__dirname, '../../public/fonts', file))
      return new Response(bytes, { headers: { 'content-type': 'font/ttf' } })
    }
    // Any image URL → a valid PNG, so logo/binding image embedding runs.
    return new Response(PIXEL_PNG, { headers: { 'content-type': 'image/png' } })
  }) as typeof fetch
})
afterAll(() => { globalThis.fetch = realFetch })

// Resolve every product/value to the pixel PNG so binding images embed.
const images: ImageResolver = {
  productImage: () => 'https://example.test/product.png',
  valueImage:   () => 'https://example.test/value.png',
}

const def = makeSampleTemplate()
const args = { definition: def, quotation, tenant, texts, lang: 'en' as const }

describe('generic renderers — sample template', () => {
  it('renders to PDF without error', async () => {
    const bytes = await renderTemplateToPdf(args)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)
    // PDF magic header "%PDF"
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
  })

  it('renders to DOCX without error', async () => {
    const bytes = await renderTemplateToDocx(args)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)
    // DOCX is a zip — magic "PK"
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  })

  it('renders to XLSX without error', async () => {
    const bytes = await renderTemplateToXlsx(args)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  })

  it('renders in Serbian without error', async () => {
    const bytes = await renderTemplateToPdf({ ...args, lang: 'sr' })
    expect(bytes.length).toBeGreaterThan(1000)
  })
})

describe('starter presets render to all three formats', () => {
  for (const preset of TEMPLATE_PRESETS) {
    it(`${preset.id} → pdf / docx / xlsx (en + sr)`, async () => {
      for (const lang of ['en', 'sr'] as const) {
        const a = { definition: preset.make(), quotation, tenant, texts, lang }
        const pdf  = await renderTemplateToPdf(a)
        const docx = await renderTemplateToDocx(a)
        const xlsx = await renderTemplateToXlsx(a)
        expect(String.fromCharCode(...pdf.slice(0, 4))).toBe('%PDF')
        expect(String.fromCharCode(docx[0], docx[1])).toBe('PK')
        expect(String.fromCharCode(xlsx[0], xlsx[1])).toBe('PK')
      }
    })
  }
})

describe('tech-spec preset with footer + per-product pagination', () => {
  // NOTE: image embedding can't be exercised under vitest — loadLogoBytes probes
  // natural dimensions via `new Image()` on a blob URL, which never settles in
  // jsdom (same reason the fixture sets tenant.logo_url = null). We therefore
  // render WITHOUT an ImageResolver here; binding-image blocks resolve to no URL
  // and are skipped. The browser path is covered manually. `images` is exported
  // for completeness / future browser-backed tests.
  it('renders DOCX and PDF with footer + page breaks', async () => {
    const a = { definition: makeTechSpecTemplate(), quotation, tenant, texts, lang: 'en' as const }
    const docx = await renderTemplateToDocx(a)
    const pdf  = await renderTemplateToPdf(a)
    expect(String.fromCharCode(docx[0], docx[1])).toBe('PK')
    expect(String.fromCharCode(...pdf.slice(0, 4))).toBe('%PDF')
    // The tech-spec preset paginates per product (pageBreakBefore) → multi-page.
    expect(pdf.length).toBeGreaterThan(3000)
  })

  it('embeds binding images in the PDF (loadLogo path, no new Image probe)', async () => {
    // PDF embedding uses pdf-lib loadLogo (no jsdom-incompatible Image probe),
    // so the image path IS exercisable here. Rendering with the resolver should
    // embed images and grow the file vs. the no-image render.
    const base = { definition: makeTechSpecTemplate(), quotation, tenant, texts, lang: 'en' as const }
    const withImages = await renderTemplateToPdf({ ...base, images })
    const without    = await renderTemplateToPdf(base)
    expect(String.fromCharCode(...withImages.slice(0, 4))).toBe('%PDF')
    expect(withImages.length).toBeGreaterThan(without.length)
  })
})

describe('page-break + footer primitives', () => {
  const def: DocumentTemplateDefinition = {
    version: 1,
    page: { footer: true, footerLabel: 'Acme' },
    blocks: [
      { id: 'a', kind: 'heading', level: 1, content: 'Page one' },
      { id: 'b', kind: 'page-break' },
      { id: 'c', kind: 'heading', level: 1, content: 'Page two', style: { align: 'justify' } },
      { id: 'd', kind: 'text', content: 'Body text that is fairly long so it can wrap and exercise the justification path across the column width nicely.', style: { align: 'justify', lineSpacing: 'relaxed' } },
    ],
  }
  it('renders to PDF and DOCX without error', async () => {
    const a = { definition: def, quotation, tenant, texts, lang: 'en' as const }
    const pdf  = await renderTemplateToPdf(a)
    const docx = await renderTemplateToDocx(a)
    expect(String.fromCharCode(...pdf.slice(0, 4))).toBe('%PDF')
    expect(String.fromCharCode(docx[0], docx[1])).toBe('PK')
  })
})

describe('heading numbering reaches the output', () => {
  // XLSX cells are easy to read back, so use it to prove the renderer actually
  // prepends the multilevel number. The fixture has 2 products; the first
  // (Studio Desk) has 3 configuration rows.
  it('numbers product/characteristic headings in document order (XLSX)', async () => {
    const def: DocumentTemplateDefinition = {
      version: 1,
      page: { numbering: true },
      blocks: [
        { id: 't', kind: 'heading', level: 1, content: 'Technical Specification' }, // NOT numbered
        { id: 'r', kind: 'repeater', over: 'quotation.line_items', children: [
          { id: 'p', kind: 'heading', level: 1, numbered: true, content: '{{line_item.product_name}}' },
          { id: 'c', kind: 'repeater', over: 'line_item.configuration', children: [
            { id: 'h', kind: 'heading', level: 2, numbered: true, content: '{{config_item.characteristic_name}}' },
          ] },
        ] },
      ],
    }
    const bytes = await renderTemplateToXlsx({ definition: def, quotation, tenant, texts, lang: 'en' })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes.buffer as ArrayBuffer)
    const cells: string[] = []
    wb.worksheets[0].eachRow(row => row.eachCell(c => { if (typeof c.value === 'string') cells.push(c.value) }))
    const joined = cells.join('\n')

    // Title heading stays unnumbered.
    expect(cells).toContain('Technical Specification')
    // First product is "1.", its first characteristic "1.1."; second product "2.".
    expect(joined).toMatch(/1\.\s+Studio Desk 140/)
    expect(joined).toMatch(/1\.1\.\s+Material/)
    expect(joined).toMatch(/2\.\s+Office Chair Pro/)
  })
})
