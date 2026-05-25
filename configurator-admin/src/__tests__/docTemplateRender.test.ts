import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// context.ts → quotations.ts → supabase.ts throws without env vars; mock it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { renderTemplateToPdf } from '@/lib/docTemplate/renderPdf'
import { renderTemplateToDocx } from '@/lib/docTemplate/renderDocx'
import { renderTemplateToXlsx } from '@/lib/docTemplate/renderXlsx'
import { makeSampleTemplate } from '@/lib/docTemplate/sampleTemplate'
import { quotation, tenant, texts } from '@/__fixtures__/quotationFixture'

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
    // No logo / images in the fixture; any other fetch returns 404.
    return new Response(null, { status: 404 })
  }) as typeof fetch
})
afterAll(() => { globalThis.fetch = realFetch })

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
