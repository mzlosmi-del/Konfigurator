import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseImportWorkbook } from '@/lib/catalogImport/parse'
import { buildImportTemplateBytes, TEMPLATE_HEADERS } from '@/lib/catalogImport/template'
import { SHEET_NAMES } from '@/lib/catalogImport/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a workbook using the canonical template header order for every
 *  parser-visible sheet. Row 1 is a placeholder instructions row, row 2 is
 *  the canonical header, then user data. The Slots reference sheet is
 *  intentionally omitted — the parser ignores it. */
async function buildCanonicalWorkbook(rowsBySheet: Record<string, (string | number)[][]>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  for (const name of [
    SHEET_NAMES.classes,
    SHEET_NAMES.characteristics,
    SHEET_NAMES.values,
    SHEET_NAMES.products,
    SHEET_NAMES.translations,
    SHEET_NAMES.texts,
    SHEET_NAMES.specifications,
  ]) {
    const ws = wb.addWorksheet(name)
    const headers = TEMPLATE_HEADERS[name]
    ws.addRow(['instructions'])
    ws.addRow(headers)
    const rows = rowsBySheet[name] ?? []
    for (const r of rows) ws.addRow(r)
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}

/** Translations rows for the canonical EN slot of one entity. Convenience
 *  for tests that want to satisfy the EN-required check without writing the
 *  full Translations sheet by hand. */
const t = (level: string, key: string, slot: string, language: string, content: string): (string | number)[] =>
  [level, key, slot, language, content]

// ── Tests ───────────────────────────────────────────────────────────────────

describe('parseImportWorkbook — sheet presence', () => {
  it('reports every missing required sheet (Slots is excluded; 7 parser-visible sheets)', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Classes')
    const buf = await wb.xlsx.writeBuffer()
    const { errors } = await parseImportWorkbook(new Uint8Array(buf as ArrayBuffer))
    const missing = errors.filter(e => /Missing required sheet/.test(e.message))
    // 7 parser-visible sheets total; 1 present (Classes); 6 missing.
    expect(missing.length).toBe(6)
  })
})

describe('parseImportWorkbook — happy path', () => {
  it('parses a minimal workbook with translations + cross-sheet links', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls-window', 1]],
      Characteristics: [['ch-colour', 'swatch', 'cls-window', 1]],
      Values:          [['v-oak', 'ch-colour', 10, '#a0703f', 1]],
      Products:        [['p-bay-120', 299, 'EUR', 'BW-120', 'pcs', 'draft', 'cls-window']],
      Translations: [
        t('class',                'cls-window', 'name', 'en', 'Window class'),
        t('class',                'cls-window', 'name', 'sr', 'Klasa prozora'),
        t('characteristic',       'ch-colour',  'name', 'en', 'Colour'),
        t('characteristic',       'ch-colour',  'name', 'sr', 'Boja'),
        t('characteristic_value', 'v-oak',      'label','en', 'Oak'),
        t('characteristic_value', 'v-oak',      'label','sr', 'Hrast'),
        t('product',              'p-bay-120',  'name', 'en', 'Bay window 120'),
        t('product',              'p-bay-120',  'name', 'sr', 'Erker 120'),
      ],
      Texts:          [['tenant', 'pdf_footer', 'en', 'Acme Co.', 0]],
      Specifications: [['product', 'p-bay-120', 'specification', 'en', 0, 'U-value 1.1']],
    })
    const { payload, errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
    expect(payload.classes).toHaveLength(1)
    expect(payload.characteristics[0].class_keys).toEqual(['cls-window'])
    expect(payload.values).toHaveLength(1)
    expect(payload.products[0].class_keys).toEqual(['cls-window'])
    expect(payload.translations).toHaveLength(8)
    expect(payload.texts).toHaveLength(1)
    expect(payload.specifications).toHaveLength(1)
  })

  it('the generated template itself round-trips through the parser', async () => {
    const bytes = await buildImportTemplateBytes()
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
  })
})

describe('parseImportWorkbook — canonical EN enforcement', () => {
  it('flags entities missing an EN translation row for their canonical slot', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [['cls-no-en', 1]],
      // No Translations row for the class → must error.
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /missing a Translations row.*language="en".*slot="name"/.test(e.message))).toBe(true)
  })

  it('flags a value missing its EN label', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 1]],
      Characteristics: [['ch', 'select', 'cls', 1]],
      Values:          [['v', 'ch', 0, '', 1]],
      Translations: [
        t('class',          'cls', 'name', 'en', 'Class'),
        t('characteristic', 'ch',  'name', 'en', 'Char'),
        // value 'v' has no label/en row
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /characteristic_value "v".*slot="label"/.test(e.message))).toBe(true)
  })
})

describe('parseImportWorkbook — required cell + enum validation', () => {
  it('flags missing required cells on Classes (key)', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [['', 1]],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.sheet === 'Classes' && e.column === 'key')).toBe(true)
  })

  it('flags invalid display_type values', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 1]],
      Characteristics: [['ch', 'invalidtype', 'cls', 1]],
      Translations: [
        t('class',          'cls', 'name', 'en', 'C'),
        t('characteristic', 'ch',  'name', 'en', 'Ch'),
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'display_type')).toBe(true)
  })

  it('flags non-numeric and negative base_price', async () => {
    for (const bad of ['not-a-number', -5]) {
      const bytes = await buildCanonicalWorkbook({
        Products:     [['p', bad as string | number, 'EUR', '', '', 'draft', '']],
        Translations: [t('product', 'p', 'name', 'en', 'P')],
      })
      const { errors } = await parseImportWorkbook(bytes)
      expect(errors.some(e => e.column === 'base_price')).toBe(true)
    }
  })

  it('flags invalid status', async () => {
    const bytes = await buildCanonicalWorkbook({
      Products:     [['p', 100, 'EUR', '', '', 'inprogress', '']],
      Translations: [t('product', 'p', 'name', 'en', 'P')],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'status')).toBe(true)
  })

  it('flags invalid hex_color', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 1]],
      Characteristics: [['ch', 'select', 'cls', 1]],
      Values:          [['v', 'ch', 0, 'NOTACOLOR', 1]],
      Translations: [
        t('class',                'cls', 'name',  'en', 'C'),
        t('characteristic',       'ch',  'name',  'en', 'Ch'),
        t('characteristic_value', 'v',   'label', 'en', 'Oak'),
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'hex_color')).toBe(true)
  })
})

describe('parseImportWorkbook — key uniqueness + references', () => {
  it('flags duplicate keys within a sheet', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [['cls-dup', 1], ['cls-dup', 2]],
      Translations: [t('class', 'cls-dup', 'name', 'en', 'Dup')],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Duplicate key/.test(e.message))).toBe(true)
  })

  it('flags unknown class_keys referenced from characteristics', async () => {
    const bytes = await buildCanonicalWorkbook({
      Characteristics: [['ch', 'select', 'ghost-class', 1]],
      Translations:    [t('characteristic', 'ch', 'name', 'en', 'Ch')],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Unknown class key/.test(e.message))).toBe(true)
  })

  it('flags unknown characteristic_key referenced from values', async () => {
    const bytes = await buildCanonicalWorkbook({
      Values:       [['v', 'ghost-char', 0, '', 1]],
      Translations: [t('characteristic_value', 'v', 'label', 'en', 'V')],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Unknown characteristic key/.test(e.message))).toBe(true)
  })

  it('supports M:N via comma-separated class_keys', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls-a', 1], ['cls-b', 2]],
      Characteristics: [['ch', 'select', 'cls-a, cls-b', 1]],
      Products:        [['p', 100, 'EUR', '', '', 'draft', 'cls-a,cls-b']],
      Translations: [
        t('class',          'cls-a', 'name', 'en', 'A'),
        t('class',          'cls-b', 'name', 'en', 'B'),
        t('characteristic', 'ch',    'name', 'en', 'Ch'),
        t('product',        'p',     'name', 'en', 'P'),
      ],
    })
    const { payload, errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
    expect(payload.characteristics[0].class_keys).toEqual(['cls-a', 'cls-b'])
    expect(payload.products[0].class_keys).toEqual(['cls-a', 'cls-b'])
  })
})

describe('parseImportWorkbook — translations sheet', () => {
  it('flags invalid translation level', async () => {
    const bytes = await buildCanonicalWorkbook({
      Translations: [t('ghost', 'k', 'name', 'en', 'X')],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'level' && /Invalid level/.test(e.message))).toBe(true)
  })

  it('flags invalid slot per level (e.g. description on class)', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:      [['cls', 1]],
      Translations: [
        t('class', 'cls', 'name',        'en', 'C'),
        t('class', 'cls', 'description', 'en', 'long'),
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'slot' && /Invalid slot/.test(e.message))).toBe(true)
  })

  it('flags duplicate (level, ref, slot, language) rows', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes: [['cls', 1]],
      Translations: [
        t('class', 'cls', 'name', 'en', 'A'),
        t('class', 'cls', 'name', 'en', 'B'),
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Duplicate/.test(e.message))).toBe(true)
  })

  it('flags translation rows referencing an unknown entity key', async () => {
    const bytes = await buildCanonicalWorkbook({
      Translations: [t('product', 'ghost-product', 'name', 'en', 'Foo')],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'reference_key' && /Unknown product key/.test(e.message))).toBe(true)
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
  it('parses product / characteristic / value specifications', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 1]],
      Characteristics: [['ch', 'select', 'cls', 1]],
      Values:          [['v', 'ch', 0, '', 1]],
      Products:        [['p', 100, 'EUR', '', '', 'draft', 'cls']],
      Translations: [
        t('class',                'cls', 'name',  'en', 'C'),
        t('characteristic',       'ch',  'name',  'en', 'Ch'),
        t('characteristic_value', 'v',   'label', 'en', 'V'),
        t('product',              'p',   'name',  'en', 'P'),
      ],
      Specifications: [
        ['product',              'p',  'specification', 'en', 0, 'U-value 1.1'],
        ['product',              'p',  'specification', 'en', 1, 'Triple glazing'],
        ['characteristic',       'ch', 'specification', 'en', 0, 'Colour spec'],
        ['characteristic_value', 'v',  'specification', 'en', 0, 'Oak details'],
      ],
    })
    const { payload, errors } = await parseImportWorkbook(bytes)
    expect(errors).toEqual([])
    expect(payload.specifications).toHaveLength(4)
  })

  it('rejects invalid slot for characteristic level', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 1]],
      Characteristics: [['ch', 'select', 'cls', 1]],
      Translations: [
        t('class',          'cls', 'name', 'en', 'C'),
        t('characteristic', 'ch',  'name', 'en', 'Ch'),
      ],
      Specifications: [['characteristic', 'ch', 'note', 'en', 0, 'Body']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'slot')).toBe(true)
  })

  it('rejects non-zero sort_order for characteristic & value specifications', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:         [['cls', 1]],
      Characteristics: [['ch', 'select', 'cls', 1]],
      Translations: [
        t('class',          'cls', 'name', 'en', 'C'),
        t('characteristic', 'ch',  'name', 'en', 'Ch'),
      ],
      Specifications: [['characteristic', 'ch', 'specification', 'en', 1, 'Body']],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => e.column === 'sort_order')).toBe(true)
  })

  it('flags duplicate (level, ref, slot, language, sort_order) rows', async () => {
    const bytes = await buildCanonicalWorkbook({
      Classes:  [['cls', 1]],
      Products: [['p', 100, 'EUR', '', '', 'draft', 'cls']],
      Translations: [
        t('class',   'cls', 'name', 'en', 'C'),
        t('product', 'p',   'name', 'en', 'P'),
      ],
      Specifications: [
        ['product', 'p', 'specification', 'en', 0, 'A'],
        ['product', 'p', 'specification', 'en', 0, 'B'],
      ],
    })
    const { errors } = await parseImportWorkbook(bytes)
    expect(errors.some(e => /Duplicate/.test(e.message))).toBe(true)
  })
})
