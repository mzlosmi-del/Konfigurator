import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseImportWorkbook } from '@/lib/catalogImport/parse'
import { buildImportTemplateBytes, TEMPLATE_HEADERS } from '@/lib/catalogImport/template'
import { SHEET_NAMES } from '@/lib/catalogImport/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

interface SheetData {
  name:    string
  headers: string[]
  rows:    (string | number)[][]
}

/** Build an .xlsx in-memory with exactly the supplied sheets (no instructions
 *  row — header is row 1). Useful for unit tests where we want to exercise
 *  the parser's fallback header detection. */
async function buildTestWorkbook(sheets: SheetData[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name)
    ws.addRow(s.headers)
    for (const r of s.rows) ws.addRow(r)
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}

/** Build a workbook that uses the canonical template header order for every
 *  sheet (and an instructions row), so we exercise the production layout. */
async function buildCanonicalWorkbook(rowsBySheet: Record<string, (string | number)[][]>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  for (const name of Object.values(SHEET_NAMES)) {
    const ws = wb.addWorksheet(name)
    const headers = TEMPLATE_HEADERS[name]
    // Row 1 instructions placeholder, row 2 headers, then data.
    ws.addRow(['instructions'])
    ws.addRow(headers)
    const rows = rowsBySheet[name] ?? []
    for (const r of rows) ws.addRow(r)
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('parseImportWorkbook — sheet presence', () => {
  it('reports every missing required sheet', async () => {
    const bytes = await buildTestWorkbook([
      { name: 'Classes', headers: ['key', 'name_en'], rows: [] },
    ])
    const { errors } = await parseImportWorkbook(bytes)
    const missing = errors.filter(e => /Missing required sheet/.test(e.message))
    expect(missing.length).toBe(5) // Characteristics, Values, Products, Texts, Specifications
  })
})

describe('parseImportWorkbook — happy path', () => {
  it('parses a minimal valid workbook with cross-sheet links', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [
        ['cls-window', 'Window class', 'Klasa prozora', 1],
      ],
      Characteristics: [
        ['ch-colour', 'Colour', 'Boja', '', '', 'swatch', 'cls-window', 1],
      ],
      Values: [
        ['v-oak', 'ch-colour', 'Oak', 'Hrast', 10, '#a0703f', 1],
      ],
      Products: [
        ['p-bay-120', 'Bay window 120', 'Erker 120', '', '', 299, 'EUR', 'BW-120', 'pcs', 'draft', 'cls-window'],
      ],
      Texts: [
        ['tenant', 'pdf_footer', 'en', 'Acme Co.', 0],
      ],
    })
    const { payload, errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
    expect(payload.classes).toHaveLength(1)
    expect(payload.characteristics).toHaveLength(1)
    expect(payload.characteristics[0].class_keys).toEqual(['cls-window'])
    expect(payload.values).toHaveLength(1)
    expect(payload.values[0].hex_color).toBe('#a0703f')
    expect(payload.products).toHaveLength(1)
    expect(payload.products[0].class_keys).toEqual(['cls-window'])
    expect(payload.texts).toHaveLength(1)
  })

  it('the generated template itself round-trips through the parser', async () => {
    const bytes = await buildImportTemplateBytes()
    const { errors } = await parseImportWorkbook(bytes)
    // The example rows are valid by construction — there should be no errors.
    expect(errors).toEqual([])
  })
})

describe('parseImportWorkbook — required cell validation', () => {
  it('flags missing required cells', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [['', 'No Key Class', '', '']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.sheet === 'Classes' && e.column === 'key')).toBe(true)
  })

  it('flags invalid display_type values', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 'A', '', 1]],
      Characteristics: [['ch', 'C', '', '', '', 'invalidtype', 'cls', 1]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'display_type')).toBe(true)
  })

  it('flags non-numeric base_price', async () => {
    const bytes = await buildCanonicalWorkbook({
      Products: [['p', 'P', '', '', '', 'not-a-number', 'EUR', '', '', 'draft', '']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'base_price')).toBe(true)
  })

  it('flags negative base_price', async () => {
    const bytes = await buildCanonicalWorkbook({
      Products: [['p', 'P', '', '', '', -5, 'EUR', '', '', 'draft', '']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'base_price')).toBe(true)
  })

  it('flags invalid status', async () => {
    const bytes = await buildCanonicalWorkbook({
      Products: [['p', 'P', '', '', '', 100, 'EUR', '', '', 'inprogress', '']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'status')).toBe(true)
  })

  it('flags invalid hex_color', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 'C', '', 1]],
      Characteristics: [['ch', 'C', '', '', '', 'select', 'cls', 1]],
      Values:          [['v', 'ch', 'Oak', '', 0, 'NOTACOLOR', 1]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'hex_color')).toBe(true)
  })
})

describe('parseImportWorkbook — key uniqueness + references', () => {
  it('flags duplicate keys within a sheet', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [
        ['cls-dup', 'A', '', 1],
        ['cls-dup', 'B', '', 2],
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Duplicate key/.test(e.message))).toBe(true)
  })

  it('flags unknown class_keys referenced from characteristics', async () => {
    const bytes = await buildCanonicalWorkbook({
      Characteristics: [['ch', 'C', '', '', '', 'select', 'ghost-class', 1]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Unknown class key/.test(e.message))).toBe(true)
  })

  it('flags unknown characteristic_key referenced from values', async () => {
    const bytes = await buildCanonicalWorkbook({
      Values: [['v', 'ghost-char', 'Oak', '', 0, '', 1]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Unknown characteristic key/.test(e.message))).toBe(true)
  })

  it('flags unknown class_keys referenced from products', async () => {
    const bytes = await buildCanonicalWorkbook({
      Products: [['p', 'P', '', '', '', 100, 'EUR', '', '', 'draft', 'ghost-class']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Unknown class key/.test(e.message))).toBe(true)
  })

  it('supports M:N via comma-separated class_keys', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls-a', 'A', '', 1], ['cls-b', 'B', '', 2]],
      Characteristics: [['ch', 'C', '', '', '', 'select', 'cls-a, cls-b', 1]],
      Products:        [['p', 'P', '', '', '', 100, 'EUR', '', '', 'draft', 'cls-a,cls-b']],
    })
    const { payload, errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
    expect(payload.characteristics[0].class_keys).toEqual(['cls-a', 'cls-b'])
    expect(payload.products[0].class_keys).toEqual(['cls-a', 'cls-b'])
  })
})

describe('parseImportWorkbook — texts sheet', () => {
  it('rejects non-tenant levels', async () => {
    const bytes = await buildCanonicalWorkbook({
      Texts: [['product', 'name', 'en', 'Foo', 0]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'level')).toBe(true)
  })

  it('rejects invalid languages', async () => {
    const bytes = await buildCanonicalWorkbook({
      Texts: [['tenant', 'pdf_footer', 'de', 'Foo', 0]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'language')).toBe(true)
  })
})

describe('parseImportWorkbook — specifications sheet', () => {
  it('parses product / characteristic / value specifications with cross-refs', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 'Class', '', 1]],
      Characteristics: [['ch', 'C', '', '', '', 'select', 'cls', 1]],
      Values:          [['v', 'ch', 'Oak', '', 0, '', 1]],
      Products:        [['p', 'P', '', '', '', 100, 'EUR', '', '', 'draft', 'cls']],
      Specifications: [
        ['product',              'p',  'specification', 'en', 0, 'U-value 1.1'],
        ['product',              'p',  'specification', 'en', 1, 'Triple glazing'],
        ['product',              'p',  'specification', 'sr', 0, 'U-vrednost 1.1'],
        ['characteristic',       'ch', 'specification', 'en', 0, 'Colour spec'],
        ['characteristic_value', 'v',  'specification', 'en', 0, 'Oak details'],
      ],
    })
    const { payload, errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
    expect(payload.specifications).toHaveLength(5)
    expect(payload.specifications[0].sort_order).toBe(0)
    expect(payload.specifications[1].sort_order).toBe(1)
  })

  it('flags unknown reference_key for each level', async () => {
    const bytes = await buildCanonicalWorkbook({
      Specifications: [
        ['product', 'ghost', 'specification', 'en', 0, 'Body'],
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'reference_key' && /Unknown product key/.test(e.message))).toBe(true)
  })

  it('rejects invalid slot for characteristic level', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 'Class', '', 1]],
      Characteristics: [['ch', 'C', '', '', '', 'select', 'cls', 1]],
      Specifications:  [['characteristic', 'ch', 'note', 'en', 0, 'Body']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'slot')).toBe(true)
  })

  it('rejects non-zero sort_order for characteristic & value specifications', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 'Class', '', 1]],
      Characteristics: [['ch', 'C', '', '', '', 'select', 'cls', 1]],
      Specifications:  [['characteristic', 'ch', 'specification', 'en', 1, 'Body']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'sort_order')).toBe(true)
  })

  it('flags duplicate (level, ref, slot, language, sort_order) rows', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 'Class', '', 1]],
      Products:        [['p', 'P', '', '', '', 100, 'EUR', '', '', 'draft', 'cls']],
      Specifications: [
        ['product', 'p', 'specification', 'en', 0, 'A'],
        ['product', 'p', 'specification', 'en', 0, 'B'],
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Duplicate/.test(e.message))).toBe(true)
  })

  it('supports product-level multi-row slots (product, note, terms)', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:  [['cls', 'Class', '', 1]],
      Products: [['p', 'P', '', '', '', 100, 'EUR', '', '', 'draft', 'cls']],
      Specifications: [
        ['product', 'p', 'product', 'en', 0, 'Block 1'],
        ['product', 'p', 'note',    'en', 0, 'A note'],
        ['product', 'p', 'terms',   'en', 0, 'Terms 1'],
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
  })
})
