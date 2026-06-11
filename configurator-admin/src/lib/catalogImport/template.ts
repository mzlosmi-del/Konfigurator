import ExcelJS from 'exceljs'
import { SHEET_NAMES, TRANSLATION_SLOTS, SPECIFICATION_SLOTS, TENANT_TEXT_SLOTS } from './types'

interface ColumnSpec {
  header:       string
  width:        number
  required:     boolean
  instructions: string
}

const CLASSES_COLS: ColumnSpec[] = [
  { header: 'key',        width: 22, required: true,  instructions: 'Unique identifier within this sheet (e.g. "window-class")' },
  { header: 'sort_order', width: 12, required: false, instructions: 'Optional ordering (number)' },
]

const CHARACTERISTICS_COLS: ColumnSpec[] = [
  { header: 'key',          width: 22, required: true,  instructions: 'Unique identifier within this sheet' },
  { header: 'display_type', width: 16, required: true,  instructions: 'One of: select, radio, swatch, toggle, number, boolean, text, color' },
  { header: 'class_keys',   width: 28, required: false, instructions: 'Comma-separated Class keys (M:N). Leave blank if unattached.' },
  { header: 'sort_order',   width: 12, required: false, instructions: 'Optional ordering (number)' },
]

const VALUES_COLS: ColumnSpec[] = [
  { header: 'key',                width: 22, required: true,  instructions: 'Unique identifier within this sheet' },
  { header: 'characteristic_key', width: 22, required: true,  instructions: 'Key of the parent Characteristic' },
  { header: 'price_modifier',     width: 14, required: false, instructions: 'Number; defaults to 0' },
  { header: 'hex_color',          width: 12, required: false, instructions: 'Hex colour for swatches (e.g. #cc8800)' },
  { header: 'sort_order',         width: 12, required: false, instructions: 'Optional ordering (number)' },
]

const PRODUCTS_COLS: ColumnSpec[] = [
  { header: 'key',             width: 22, required: true,  instructions: 'Unique identifier within this sheet' },
  { header: 'base_price',      width: 14, required: true,  instructions: 'Numeric base price (>= 0)' },
  { header: 'currency',        width: 10, required: false, instructions: 'ISO 3-letter code (defaults to EUR)' },
  { header: 'sku',             width: 16, required: false, instructions: 'Optional SKU' },
  { header: 'unit_of_measure', width: 14, required: false, instructions: 'Optional (e.g. pcs, m, m2)' },
  { header: 'status',          width: 14, required: false, instructions: 'draft | published | archived (default draft)' },
  { header: 'class_keys',      width: 30, required: false, instructions: 'Comma-separated Class keys (M:N)' },
]

const TRANSLATIONS_COLS: ColumnSpec[] = [
  { header: 'level',         width: 22, required: true,  instructions: 'class | characteristic | characteristic_value | product' },
  { header: 'reference_key', width: 22, required: true,  instructions: 'Key from the matching entity sheet' },
  { header: 'slot',          width: 16, required: true,  instructions: 'Allowed slot per level — see the Slots reference sheet' },
  { header: 'language',      width: 10, required: true,  instructions: 'en or sr' },
  { header: 'content',       width: 60, required: true,  instructions: 'The translated text' },
]

const TEXTS_COLS: ColumnSpec[] = [
  { header: 'level',      width: 12, required: true,  instructions: 'Only "tenant" is supported here' },
  { header: 'slot',       width: 22, required: true,  instructions: 'See the Slots reference sheet (tenant level)' },
  { header: 'language',   width: 10, required: true,  instructions: 'en or sr' },
  { header: 'content',    width: 60, required: true,  instructions: 'The text content' },
  { header: 'sort_order', width: 12, required: false, instructions: 'Used for multi-row slots (terms_line, etc.)' },
]

const SPECIFICATIONS_COLS: ColumnSpec[] = [
  { header: 'level',         width: 22, required: true,  instructions: 'product | characteristic | characteristic_value' },
  { header: 'reference_key', width: 22, required: true,  instructions: 'Key from the matching entity sheet' },
  { header: 'slot',          width: 16, required: true,  instructions: 'Allowed slot per level — see the Slots reference sheet' },
  { header: 'language',      width: 10, required: true,  instructions: 'en or sr' },
  { header: 'sort_order',    width: 12, required: false, instructions: 'Order within the same (level, ref, slot, language). Use 0, 1, 2, … for multi-line product blocks' },
  { header: 'content',       width: 60, required: true,  instructions: 'The text content for that language' },
]

interface SheetSpec {
  name:         string
  cols:         ColumnSpec[]
  examples:     Record<string, string | number>[]
  instructions: string
}

const SHEET_SPECS: SheetSpec[] = [
  {
    name:         SHEET_NAMES.classes,
    cols:         CLASSES_COLS,
    instructions: 'Classes group Characteristics so that multiple Products can share the same set. Names are entered on the Translations sheet (one row per language). Same class can be reused across many products.',
    examples:     [{ key: 'window-class', sort_order: 1 }],
  },
  {
    name:         SHEET_NAMES.characteristics,
    cols:         CHARACTERISTICS_COLS,
    instructions: 'Characteristics are the configurable options on a Product (e.g. colour, size). Names + descriptions live on the Translations sheet. Link to Classes via "class_keys" (comma-separated).',
    examples:     [{ key: 'colour', display_type: 'swatch', class_keys: 'window-class', sort_order: 1 }],
  },
  {
    name:         SHEET_NAMES.values,
    cols:         VALUES_COLS,
    instructions: 'Values are the choices a customer picks for a Characteristic. Labels live on the Translations sheet (slot="label"). Each value belongs to exactly one Characteristic.',
    examples:     [{ key: 'colour-oak', characteristic_key: 'colour', price_modifier: 0, hex_color: '#a0703f', sort_order: 1 }],
  },
  {
    name:         SHEET_NAMES.products,
    cols:         PRODUCTS_COLS,
    instructions: 'Products are the items customers configure. Names + descriptions live on the Translations sheet. Attach Classes via "class_keys" (comma-separated) — the same class can be used on multiple products.',
    examples:     [{ key: 'bay-window-120', base_price: 299, currency: 'EUR', sku: 'BW-120', unit_of_measure: 'pcs', status: 'draft', class_keys: 'window-class' }],
  },
  {
    name:         SHEET_NAMES.translations,
    cols:         TRANSLATIONS_COLS,
    instructions: 'Translations for entity names + descriptions (one row per entity per slot per language). Every entity must have at least one row here with language="en" and the canonical slot ("name" or, for values, "label"). Add an "sr" row for each translatable field that should be translated.',
    examples:     [
      { level: 'class',                reference_key: 'window-class',    slot: 'name',        language: 'en', content: 'Window class' },
      { level: 'class',                reference_key: 'window-class',    slot: 'name',        language: 'sr', content: 'Klasa prozora' },
      { level: 'characteristic',       reference_key: 'colour',          slot: 'name',        language: 'en', content: 'Colour' },
      { level: 'characteristic',       reference_key: 'colour',          slot: 'name',        language: 'sr', content: 'Boja' },
      { level: 'characteristic_value', reference_key: 'colour-oak',      slot: 'label',       language: 'en', content: 'Oak' },
      { level: 'characteristic_value', reference_key: 'colour-oak',      slot: 'label',       language: 'sr', content: 'Hrast' },
      { level: 'product',              reference_key: 'bay-window-120',  slot: 'name',        language: 'en', content: 'Bay window 120 cm' },
      { level: 'product',              reference_key: 'bay-window-120',  slot: 'name',        language: 'sr', content: 'Erker prozor 120 cm' },
      { level: 'product',              reference_key: 'bay-window-120',  slot: 'description', language: 'en', content: 'Double-glazed bay window' },
    ],
  },
  {
    name:         SHEET_NAMES.texts,
    cols:         TEXTS_COLS,
    instructions: 'Tenant-level text blocks (PDF footer, page title, terms lines, etc.). Per-entity translations go on the Translations or Specifications sheet, not here.',
    examples:     [{ level: 'tenant', slot: 'pdf_footer', language: 'en', content: 'Configureout — Acme Co.', sort_order: 0 }],
  },
  {
    name:         SHEET_NAMES.specifications,
    cols:         SPECIFICATIONS_COLS,
    instructions: 'Specification text and other multi-line product blocks (product, note, terms). One row per (entity, slot, language, sort_order). For multi-line blocks, repeat the same key+slot+language with increasing sort_order. Characteristic and value specifications are single-row (sort_order = 0).',
    examples:     [{ level: 'product', reference_key: 'bay-window-120', slot: 'specification', language: 'en', sort_order: 0, content: 'Double-glazed, 24 mm pane, U-value 1.1 W/m²K' }],
  },
]

// ── Slots reference sheet ────────────────────────────────────────────────────

interface SlotRow {
  level:      string
  slot:       string
  multiRow:   boolean
  usedOn:     string
  description: string
}

function buildSlotCatalogue(): SlotRow[] {
  const rows: SlotRow[] = []

  // Translations sheet (single-row entity translations).
  for (const [level, slots] of Object.entries(TRANSLATION_SLOTS)) {
    for (const slot of slots) {
      rows.push({
        level, slot, multiRow: false, usedOn: 'Translations',
        description: describeSlot(level, slot),
      })
    }
  }

  // Specifications sheet.
  for (const [level, slots] of Object.entries(SPECIFICATION_SLOTS)) {
    for (const slot of slots) {
      const multi = level === 'product'
      rows.push({
        level, slot, multiRow: multi, usedOn: 'Specifications',
        description: describeSlot(level, slot),
      })
    }
  }

  // Texts sheet (tenant-level).
  for (const slot of TENANT_TEXT_SLOTS) {
    rows.push({
      level: 'tenant', slot,
      multiRow: ['terms_line', 'product', 'specification', 'note', 'terms'].includes(slot),
      usedOn: 'Texts',
      description: describeTenantSlot(slot),
    })
  }

  return rows
}

function describeSlot(level: string, slot: string): string {
  if (slot === 'name')          return `Display name of the ${level.replace('_', ' ')}`
  if (slot === 'label')         return 'Customer-facing label of the value (e.g. "Oak")'
  if (slot === 'description')   return 'Long-form description'
  if (slot === 'specification') return 'Technical specification text'
  if (slot === 'note')          return 'Free-form note appended to the product'
  if (slot === 'terms')         return 'Terms & conditions text for the product'
  if (slot === 'product')       return 'Marketing copy / product story'
  return ''
}

function describeTenantSlot(slot: string): string {
  switch (slot) {
    case 'pdf_footer':              return 'Footer text shown on every PDF page'
    case 'public_page_title':       return 'Title of the public product page'
    case 'post_inquiry_message':    return 'Thank-you message after inquiry submission'
    case 'quotation_email_intro':   return 'Intro paragraph in the quotation email'
    case 'quotation_accept_message':return 'Message shown when a customer accepts a quotation'
    case 'quotation_reject_message':return 'Message shown when a customer rejects a quotation'
    case 'terms_line':              return 'Multi-row: each row = one bullet in the standard terms list'
    case 'product':                 return 'Multi-row global "About the products" blocks'
    case 'specification':           return 'Multi-row global specification blocks'
    case 'note':                    return 'Multi-row global notes'
    case 'terms':                   return 'Multi-row global terms blocks'
    default: return ''
  }
}

const SLOTS_COLS: ColumnSpec[] = [
  { header: 'level',       width: 22, required: false, instructions: '' },
  { header: 'slot',        width: 22, required: false, instructions: '' },
  { header: 'multi_row',   width: 12, required: false, instructions: '' },
  { header: 'used_on',     width: 16, required: false, instructions: '' },
  { header: 'description', width: 60, required: false, instructions: '' },
]

/** Build a fresh template workbook with all sheets, headers, an instructions
 *  row, and example rows. The Slots sheet is a read-only reference. */
export async function buildImportTemplateBytes(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Configureout'
  wb.title   = 'Catalog import template'
  wb.created = new Date()

  for (const spec of SHEET_SPECS) {
    const ws = wb.addWorksheet(spec.name)
    ws.columns = spec.cols.map(c => ({ header: c.header, key: c.header, width: c.width }))

    // Row 1: merged instructions banner.
    const numCols = spec.cols.length
    const lastCol = ws.getColumn(numCols).letter
    ws.spliceRows(1, 0, [spec.instructions])
    ws.mergeCells(`A1:${lastCol}1`)
    const banner = ws.getCell('A1')
    banner.font      = { italic: true, color: { argb: 'FF6C7179' } }
    banner.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    banner.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FB' } }
    ws.getRow(1).height = spec.name === SHEET_NAMES.translations ? 60 : 36

    // Row 2: headers (auto-added by ws.columns; style them).
    const headerRow = ws.getRow(2)
    headerRow.font      = { bold: true }
    headerRow.alignment = { vertical: 'middle' }
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF0' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD2D4D8' } } }
    })

    // Rows 3..: example data (italic muted, so users know to overwrite).
    for (const ex of spec.examples) {
      ws.addRow(spec.cols.map(c => ex[c.header] ?? ''))
    }
    for (let i = 0; i < spec.examples.length; i++) {
      ws.getRow(3 + i).font = { color: { argb: 'FF6C7179' }, italic: true }
    }

    ws.views = [{ state: 'frozen', ySplit: 2 }]
  }

  // ── Slots reference sheet ──────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet(SHEET_NAMES.slots)
    ws.columns = SLOTS_COLS.map(c => ({ header: c.header, key: c.header, width: c.width }))

    const numCols = SLOTS_COLS.length
    const lastCol = ws.getColumn(numCols).letter
    ws.spliceRows(1, 0, ['Reference: every legal slot value, the level it belongs to, and which sheet uses it. This sheet is read-only — fill data on the other sheets.'])
    ws.mergeCells(`A1:${lastCol}1`)
    const banner = ws.getCell('A1')
    banner.font      = { italic: true, color: { argb: 'FF6C7179' } }
    banner.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    banner.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FB' } }
    ws.getRow(1).height = 36

    const headerRow = ws.getRow(2)
    headerRow.font      = { bold: true }
    headerRow.alignment = { vertical: 'middle' }
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF0' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD2D4D8' } } }
    })

    for (const row of buildSlotCatalogue()) {
      ws.addRow({
        level:       row.level,
        slot:        row.slot,
        multi_row:   row.multiRow ? 'yes' : 'no',
        used_on:     row.usedOn,
        description: row.description,
      })
    }
    ws.views = [{ state: 'frozen', ySplit: 2 }]
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

/** Headers in canonical order, used by the parser to validate uploads. The
 *  Slots reference sheet is intentionally absent — the parser ignores it. */
export const TEMPLATE_HEADERS: Record<string, string[]> = {
  [SHEET_NAMES.classes]:         CLASSES_COLS.map(c => c.header),
  [SHEET_NAMES.characteristics]: CHARACTERISTICS_COLS.map(c => c.header),
  [SHEET_NAMES.values]:          VALUES_COLS.map(c => c.header),
  [SHEET_NAMES.products]:        PRODUCTS_COLS.map(c => c.header),
  [SHEET_NAMES.translations]:    TRANSLATIONS_COLS.map(c => c.header),
  [SHEET_NAMES.texts]:           TEXTS_COLS.map(c => c.header),
  [SHEET_NAMES.specifications]:  SPECIFICATIONS_COLS.map(c => c.header),
}

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  [SHEET_NAMES.classes]:         CLASSES_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.characteristics]: CHARACTERISTICS_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.values]:          VALUES_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.products]:        PRODUCTS_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.translations]:    TRANSLATIONS_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.texts]:           TEXTS_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.specifications]:  SPECIFICATIONS_COLS.filter(c => c.required).map(c => c.header),
}

/** Sheets the parser walks. The Slots reference sheet is excluded — it's
 *  read-only documentation, not data. */
export const PARSED_SHEET_NAMES = [
  SHEET_NAMES.classes,
  SHEET_NAMES.characteristics,
  SHEET_NAMES.values,
  SHEET_NAMES.products,
  SHEET_NAMES.translations,
  SHEET_NAMES.texts,
  SHEET_NAMES.specifications,
] as const
