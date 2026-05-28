import ExcelJS from 'exceljs'
import { SHEET_NAMES } from './types'

interface ColumnSpec {
  header:       string
  width:        number
  required:     boolean
  instructions: string
}

const CLASSES_COLS: ColumnSpec[] = [
  { header: 'key',        width: 22, required: true,  instructions: 'Unique identifier within this sheet (e.g. "window-class")' },
  { header: 'name_en',    width: 28, required: true,  instructions: 'English name shown in the catalog' },
  { header: 'name_sr',    width: 28, required: false, instructions: 'Optional Serbian translation' },
  { header: 'sort_order', width: 12, required: false, instructions: 'Optional ordering (number)' },
]

const CHARACTERISTICS_COLS: ColumnSpec[] = [
  { header: 'key',            width: 22, required: true,  instructions: 'Unique identifier within this sheet' },
  { header: 'name_en',        width: 24, required: true,  instructions: 'English name (canonical)' },
  { header: 'name_sr',        width: 24, required: false, instructions: 'Optional Serbian translation' },
  { header: 'description_en', width: 30, required: false, instructions: 'Optional EN description' },
  { header: 'description_sr', width: 30, required: false, instructions: 'Optional SR description' },
  { header: 'display_type',   width: 16, required: true,  instructions: 'One of: select, radio, swatch, toggle, number, boolean' },
  { header: 'class_keys',     width: 28, required: false, instructions: 'Comma-separated Class keys (M:N). Leave blank if unattached.' },
  { header: 'sort_order',     width: 12, required: false, instructions: 'Optional ordering (number)' },
]

const VALUES_COLS: ColumnSpec[] = [
  { header: 'key',                width: 22, required: true,  instructions: 'Unique identifier within this sheet' },
  { header: 'characteristic_key', width: 22, required: true,  instructions: 'Key of the parent Characteristic' },
  { header: 'label_en',           width: 22, required: true,  instructions: 'EN label shown to customers' },
  { header: 'label_sr',           width: 22, required: false, instructions: 'Optional SR translation' },
  { header: 'price_modifier',     width: 14, required: false, instructions: 'Number; defaults to 0' },
  { header: 'hex_color',          width: 12, required: false, instructions: 'Hex colour for swatches (e.g. #cc8800)' },
  { header: 'sort_order',         width: 12, required: false, instructions: 'Optional ordering (number)' },
]

const PRODUCTS_COLS: ColumnSpec[] = [
  { header: 'key',             width: 22, required: true,  instructions: 'Unique identifier within this sheet' },
  { header: 'name_en',         width: 30, required: true,  instructions: 'EN name (canonical)' },
  { header: 'name_sr',         width: 30, required: false, instructions: 'Optional SR translation' },
  { header: 'description_en',  width: 36, required: false, instructions: 'Optional EN description' },
  { header: 'description_sr',  width: 36, required: false, instructions: 'Optional SR description' },
  { header: 'base_price',      width: 14, required: true,  instructions: 'Numeric base price (>= 0)' },
  { header: 'currency',        width: 10, required: false, instructions: 'ISO 3-letter code (defaults to EUR)' },
  { header: 'sku',             width: 16, required: false, instructions: 'Optional SKU' },
  { header: 'unit_of_measure', width: 14, required: false, instructions: 'Optional (e.g. pcs, m, m2)' },
  { header: 'status',          width: 14, required: false, instructions: 'draft | published | archived (default draft)' },
  { header: 'class_keys',      width: 30, required: false, instructions: 'Comma-separated Class keys (M:N)' },
]

const TEXTS_COLS: ColumnSpec[] = [
  { header: 'level',      width: 12, required: true,  instructions: 'Only "tenant" is supported in this template' },
  { header: 'slot',       width: 22, required: true,  instructions: 'e.g. pdf_footer, public_page_title, terms_line' },
  { header: 'language',   width: 10, required: true,  instructions: 'en or sr' },
  { header: 'content',    width: 60, required: true,  instructions: 'The text content' },
  { header: 'sort_order', width: 12, required: false, instructions: 'Used for multi-row slots (terms_line, etc.)' },
]

interface SheetSpec {
  name:         string
  cols:         ColumnSpec[]
  example:      Record<string, string | number>
  instructions: string
}

const SHEET_SPECS: SheetSpec[] = [
  {
    name:         SHEET_NAMES.classes,
    cols:         CLASSES_COLS,
    instructions: 'Classes group Characteristics so that multiple Products can share the same set. Same class can be reused across many products; same characteristic can belong to many classes.',
    example:      { key: 'window-class', name_en: 'Window class', name_sr: 'Klasa prozora', sort_order: 1 },
  },
  {
    name:         SHEET_NAMES.characteristics,
    cols:         CHARACTERISTICS_COLS,
    instructions: 'Characteristics are the configurable options on a Product (e.g. colour, size). Link them to Classes via "class_keys" (comma-separated).',
    example:      { key: 'colour', name_en: 'Colour', name_sr: 'Boja', description_en: '', description_sr: '', display_type: 'swatch', class_keys: 'window-class', sort_order: 1 },
  },
  {
    name:         SHEET_NAMES.values,
    cols:         VALUES_COLS,
    instructions: 'Values are the choices a customer picks for a Characteristic. Each value belongs to exactly one Characteristic via "characteristic_key".',
    example:      { key: 'colour-oak', characteristic_key: 'colour', label_en: 'Oak', label_sr: 'Hrast', price_modifier: 0, hex_color: '#a0703f', sort_order: 1 },
  },
  {
    name:         SHEET_NAMES.products,
    cols:         PRODUCTS_COLS,
    instructions: 'Products are the items customers configure. Attach Classes via "class_keys" (comma-separated) — the same class can be used on multiple products.',
    example:      { key: 'bay-window-120', name_en: 'Bay window 120 cm', name_sr: 'Erker prozor 120 cm', description_en: 'Double-glazed bay window', description_sr: '', base_price: 299, currency: 'EUR', sku: 'BW-120', unit_of_measure: 'pcs', status: 'draft', class_keys: 'window-class' },
  },
  {
    name:         SHEET_NAMES.texts,
    cols:         TEXTS_COLS,
    instructions: 'Tenant-level text blocks (PDF footer, page title, terms lines, etc.). Per-product / per-characteristic translations belong inline on those sheets, not here.',
    example:      { level: 'tenant', slot: 'pdf_footer', language: 'en', content: 'Configureout — Acme Co.', sort_order: 0 },
  },
]

/** Build a fresh template workbook with all five sheets, headers, an
 *  instructions row, and one filled-in example row per sheet. Returns the
 *  raw bytes ready to download. */
export async function buildImportTemplateBytes(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Configureout'
  wb.title   = 'Catalog import template'
  wb.created = new Date()

  for (const spec of SHEET_SPECS) {
    const ws = wb.addWorksheet(spec.name)
    ws.columns = spec.cols.map(c => ({ header: c.header, key: c.header, width: c.width }))

    // Row 1 (instructions): merged across all columns, italic muted text.
    const numCols = spec.cols.length
    const lastCol = ws.getColumn(numCols).letter
    ws.spliceRows(1, 0, [spec.instructions])
    ws.mergeCells(`A1:${lastCol}1`)
    const banner = ws.getCell('A1')
    banner.font      = { italic: true, color: { argb: 'FF6C7179' } }
    banner.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    banner.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FB' } }
    ws.getRow(1).height = 36

    // Row 2: headers (already added by ws.columns, but the splice pushed it
    // down). Style it.
    const headerRow = ws.getRow(2)
    headerRow.font      = { bold: true }
    headerRow.alignment = { vertical: 'middle' }
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF0' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD2D4D8' } } }
    })

    // Row 3: example values — labelled so users know to delete / overwrite.
    const exampleRow = spec.cols.map(c => spec.example[c.header] ?? '')
    ws.addRow(exampleRow)
    const exampleRowRef = ws.getRow(3)
    exampleRowRef.font = { color: { argb: 'FF6C7179' }, italic: true }

    // Freeze the instructions + header rows so headers stay visible.
    ws.views = [{ state: 'frozen', ySplit: 2 }]
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

/** Headers in the canonical order, exposed so the parser can validate that
 *  uploaded files have the right structure. */
export const TEMPLATE_HEADERS: Record<string, string[]> = {
  [SHEET_NAMES.classes]:         CLASSES_COLS.map(c => c.header),
  [SHEET_NAMES.characteristics]: CHARACTERISTICS_COLS.map(c => c.header),
  [SHEET_NAMES.values]:          VALUES_COLS.map(c => c.header),
  [SHEET_NAMES.products]:        PRODUCTS_COLS.map(c => c.header),
  [SHEET_NAMES.texts]:           TEXTS_COLS.map(c => c.header),
}

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  [SHEET_NAMES.classes]:         CLASSES_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.characteristics]: CHARACTERISTICS_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.values]:          VALUES_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.products]:        PRODUCTS_COLS.filter(c => c.required).map(c => c.header),
  [SHEET_NAMES.texts]:           TEXTS_COLS.filter(c => c.required).map(c => c.header),
}
