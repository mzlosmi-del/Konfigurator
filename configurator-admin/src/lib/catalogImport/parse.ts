import ExcelJS from 'exceljs'
import type { DisplayType, ProductStatus } from '@/types/database'
import {
  SHEET_NAMES,
  DISPLAY_TYPES,
  PRODUCT_STATUSES,
  TEXT_LANGUAGES,
  SPECIFICATION_SLOTS,
  type CatalogImportPayload,
  type ImportError,
  type ParseResult,
  type ParsedClass,
  type ParsedCharacteristic,
  type ParsedValue,
  type ParsedProduct,
  type ParsedText,
  type ParsedSpecification,
  type SpecificationLevel,
  type TextLanguage,
} from './types'
import { TEMPLATE_HEADERS, REQUIRED_COLUMNS } from './template'

/** Read a File / Blob / ArrayBuffer into an ExcelJS workbook, then walk every
 *  sheet collecting parsed rows and validation errors. The function is pure
 *  — it does not touch network, DB, or storage. */
export async function parseImportWorkbook(input: ArrayBuffer | Uint8Array): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  const buf = input instanceof Uint8Array ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : input
  await wb.xlsx.load(buf as ArrayBuffer)

  const errors: ImportError[] = []

  // 1. Sheet presence check
  for (const required of Object.values(SHEET_NAMES)) {
    if (!wb.getWorksheet(required)) {
      errors.push({ sheet: null, row: null, column: null, message: `Missing required sheet "${required}"` })
    }
  }
  if (errors.length > 0) {
    return { payload: emptyPayload(), errors }
  }

  // 2. Per-sheet header validation
  const sheetRows: Record<string, RawRow[]> = {}
  for (const sheetName of Object.values(SHEET_NAMES)) {
    const ws = wb.getWorksheet(sheetName)!
    const headerResult = readHeader(ws, sheetName, errors)
    if (!headerResult) {
      sheetRows[sheetName] = []
      continue
    }
    sheetRows[sheetName] = readRows(ws, headerResult.colMap, headerResult.headerRow)
  }
  if (errors.length > 0) {
    return { payload: emptyPayload(), errors }
  }

  // 3. Parse each sheet (per-row validation)
  const classes        = parseClasses(sheetRows[SHEET_NAMES.classes], errors)
  const characteristics = parseCharacteristics(sheetRows[SHEET_NAMES.characteristics], errors)
  const values         = parseValues(sheetRows[SHEET_NAMES.values], errors)
  const products       = parseProducts(sheetRows[SHEET_NAMES.products], errors)
  const texts          = parseTexts(sheetRows[SHEET_NAMES.texts], errors)
  const specifications = parseSpecifications(sheetRows[SHEET_NAMES.specifications], errors)

  // 4. Within-sheet key uniqueness
  checkKeyUniqueness(SHEET_NAMES.classes,         classes,         errors)
  checkKeyUniqueness(SHEET_NAMES.characteristics, characteristics, errors)
  checkKeyUniqueness(SHEET_NAMES.values,          values,          errors)
  checkKeyUniqueness(SHEET_NAMES.products,        products,        errors)

  // 5. Cross-sheet reference resolution
  const classKeys          = new Set(classes.map(c => c.key))
  const characteristicKeys = new Set(characteristics.map(c => c.key))
  const valueKeys          = new Set(values.map(v => v.key))
  const productKeys        = new Set(products.map(p => p.key))

  characteristics.forEach((c, idx) => {
    for (const ck of c.class_keys) {
      if (!classKeys.has(ck)) {
        errors.push({
          sheet: SHEET_NAMES.characteristics, row: rowNumberOf(idx), column: 'class_keys',
          message: `Unknown class key "${ck}" — add it to the Classes sheet first`,
        })
      }
    }
  })

  values.forEach((v, idx) => {
    if (!characteristicKeys.has(v.characteristic_key)) {
      errors.push({
        sheet: SHEET_NAMES.values, row: rowNumberOf(idx), column: 'characteristic_key',
        message: `Unknown characteristic key "${v.characteristic_key}"`,
      })
    }
  })

  products.forEach((p, idx) => {
    for (const ck of p.class_keys) {
      if (!classKeys.has(ck)) {
        errors.push({
          sheet: SHEET_NAMES.products, row: rowNumberOf(idx), column: 'class_keys',
          message: `Unknown class key "${ck}"`,
        })
      }
    }
  })

  // Specifications: validate reference_key against the sheet matching `level`.
  specifications.forEach((s, idx) => {
    const ctx = { sheet: SHEET_NAMES.specifications, row: rowNumberOf(idx) }
    const refOk =
      (s.level === 'product'              && productKeys.has(s.reference_key)) ||
      (s.level === 'characteristic'       && characteristicKeys.has(s.reference_key)) ||
      (s.level === 'characteristic_value' && valueKeys.has(s.reference_key))
    if (!refOk) {
      errors.push({
        sheet: ctx.sheet, row: ctx.row, column: 'reference_key',
        message: `Unknown ${s.level} key "${s.reference_key}"`,
      })
    }
  })

  // Within-sheet uniqueness for (level, ref, slot, language, sort_order) on
  // Specifications. Two rows with the same natural key would later collide
  // with the tenant_texts unique index.
  const specSeen = new Map<string, number>()
  specifications.forEach((s, idx) => {
    const k = `${s.level}::${s.reference_key}::${s.slot}::${s.language}::${s.sort_order ?? 0}`
    if (specSeen.has(k)) {
      errors.push({
        sheet: SHEET_NAMES.specifications, row: rowNumberOf(idx), column: 'sort_order',
        message: `Duplicate (level, reference_key, slot, language, sort_order) — first seen at row ${rowNumberOf(specSeen.get(k)!)}`,
      })
    } else {
      specSeen.set(k, idx)
    }
  })

  return {
    payload: { classes, characteristics, values, products, texts, specifications },
    errors,
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

type RawRow = {
  /** 1-based row index as it appears in Excel. */
  excelRow: number
  cells:    Record<string, string>
}

function emptyPayload(): CatalogImportPayload {
  return { classes: [], characteristics: [], values: [], products: [], texts: [], specifications: [] }
}

/** Header row is row 2 in the template (row 1 is the instructions banner).
 *  We accept either layout though: if row 1 already looks like headers, use
 *  it; otherwise use row 2. This way users can re-save the template from
 *  programs that strip merged-cell instruction rows. */
function readHeader(ws: ExcelJS.Worksheet, sheetName: string, errors: ImportError[]): { colMap: Map<string, number>; headerRow: number } | null {
  const required = REQUIRED_COLUMNS[sheetName] ?? []
  const canonical = TEMPLATE_HEADERS[sheetName] ?? []

  for (const candidate of [2, 1]) {
    const row = ws.getRow(candidate)
    const colMap = new Map<string, number>()
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const v = cellToString(cell)
      if (v) colMap.set(v.toLowerCase(), colNumber)
    })
    // Header row must contain every required column.
    if (required.every(h => colMap.has(h))) {
      // Flag any unknown columns (warning-level — still fail strict mode)
      const unknown: string[] = []
      colMap.forEach((_, name) => { if (!canonical.includes(name)) unknown.push(name) })
      if (unknown.length > 0) {
        errors.push({
          sheet: sheetName, row: candidate, column: null,
          message: `Unknown column(s): ${unknown.join(', ')} — remove or rename to match the template`,
        })
      }
      return { colMap, headerRow: candidate }
    }
  }

  const missing = required.filter(h => {
    // crude check across rows 1 + 2
    for (const r of [1, 2]) {
      let found = false
      ws.getRow(r).eachCell({ includeEmpty: false }, cell => {
        if (cellToString(cell).toLowerCase() === h) found = true
      })
      if (found) return false
    }
    return true
  })
  errors.push({
    sheet: sheetName, row: null, column: null,
    message: `Missing required column(s): ${missing.join(', ')}`,
  })
  return null
}

function readRows(ws: ExcelJS.Worksheet, colMap: Map<string, number>, headerRowNum: number): RawRow[] {
  const out: RawRow[] = []
  ws.eachRow({ includeEmpty: false }, (row, excelRow) => {
    if (excelRow <= headerRowNum) return
    const cells: Record<string, string> = {}
    let anyNonEmpty = false
    colMap.forEach((colNum, header) => {
      const v = cellToString(row.getCell(colNum))
      cells[header] = v
      if (v.length > 0) anyNonEmpty = true
    })
    if (anyNonEmpty) out.push({ excelRow, cells })
  })
  return out
}

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof Date) return v.toISOString()
  // Rich text or formula result
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map(r => r.text).join('').trim()
    }
    if ('result' in v && v.result != null) return String(v.result).trim()
    if ('text' in v && typeof v.text === 'string') return v.text.trim()
  }
  return String(v).trim()
}

// ── Per-sheet parsers ───────────────────────────────────────────────────────

function parseClasses(rows: RawRow[], errors: ImportError[]): ParsedClass[] {
  const out: ParsedClass[] = []
  for (const r of rows) {
    const ctx = { sheet: SHEET_NAMES.classes, row: r.excelRow, errors }
    const key = required(r.cells, 'key', ctx)
    const name_en = required(r.cells, 'name_en', ctx)
    if (!key || !name_en) continue
    out.push({
      key,
      name_en,
      name_sr:    optional(r.cells, 'name_sr'),
      sort_order: parseOptionalInt(r.cells, 'sort_order', ctx),
    })
  }
  return out
}

function parseCharacteristics(rows: RawRow[], errors: ImportError[]): ParsedCharacteristic[] {
  const out: ParsedCharacteristic[] = []
  for (const r of rows) {
    const ctx = { sheet: SHEET_NAMES.characteristics, row: r.excelRow, errors }
    const key = required(r.cells, 'key', ctx)
    const name_en = required(r.cells, 'name_en', ctx)
    const display_type_raw = required(r.cells, 'display_type', ctx)
    if (!key || !name_en || !display_type_raw) continue

    const dt = display_type_raw.toLowerCase() as DisplayType
    if (!DISPLAY_TYPES.includes(dt)) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'display_type',
        message: `Invalid display_type "${display_type_raw}". Allowed: ${DISPLAY_TYPES.join(', ')}` })
      continue
    }

    out.push({
      key,
      name_en,
      name_sr:        optional(r.cells, 'name_sr'),
      description_en: optional(r.cells, 'description_en'),
      description_sr: optional(r.cells, 'description_sr'),
      display_type:   dt,
      class_keys:     splitCsv(r.cells['class_keys']),
      sort_order:     parseOptionalInt(r.cells, 'sort_order', ctx),
    })
  }
  return out
}

function parseValues(rows: RawRow[], errors: ImportError[]): ParsedValue[] {
  const out: ParsedValue[] = []
  for (const r of rows) {
    const ctx = { sheet: SHEET_NAMES.values, row: r.excelRow, errors }
    const key = required(r.cells, 'key', ctx)
    const characteristic_key = required(r.cells, 'characteristic_key', ctx)
    const label_en = required(r.cells, 'label_en', ctx)
    if (!key || !characteristic_key || !label_en) continue

    const price_modifier_raw = r.cells['price_modifier']
    let price_modifier = 0
    if (price_modifier_raw) {
      const n = Number(price_modifier_raw)
      if (Number.isNaN(n)) {
        errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'price_modifier',
          message: `Invalid number "${price_modifier_raw}"` })
        continue
      }
      price_modifier = n
    }

    const hex_color_raw = optional(r.cells, 'hex_color')
    if (hex_color_raw && !/^#?[0-9a-fA-F]{6}$/.test(hex_color_raw)) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'hex_color',
        message: `Invalid hex colour "${hex_color_raw}" (expected 6 hex digits, optionally prefixed by #)` })
      continue
    }

    out.push({
      key,
      characteristic_key,
      label_en,
      label_sr:      optional(r.cells, 'label_sr'),
      price_modifier,
      hex_color:     hex_color_raw ? (hex_color_raw.startsWith('#') ? hex_color_raw : `#${hex_color_raw}`) : null,
      sort_order:    parseOptionalInt(r.cells, 'sort_order', ctx),
    })
  }
  return out
}

function parseProducts(rows: RawRow[], errors: ImportError[]): ParsedProduct[] {
  const out: ParsedProduct[] = []
  for (const r of rows) {
    const ctx = { sheet: SHEET_NAMES.products, row: r.excelRow, errors }
    const key = required(r.cells, 'key', ctx)
    const name_en = required(r.cells, 'name_en', ctx)
    const base_price_raw = required(r.cells, 'base_price', ctx)
    if (!key || !name_en || !base_price_raw) continue

    const base_price = Number(base_price_raw)
    if (Number.isNaN(base_price) || base_price < 0) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'base_price',
        message: `Invalid price "${base_price_raw}" (must be a non-negative number)` })
      continue
    }

    let status: ProductStatus = 'draft'
    const status_raw = optional(r.cells, 'status')
    if (status_raw) {
      const s = status_raw.toLowerCase() as ProductStatus
      if (!PRODUCT_STATUSES.includes(s)) {
        errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'status',
          message: `Invalid status "${status_raw}". Allowed: ${PRODUCT_STATUSES.join(', ')}` })
        continue
      }
      status = s
    }

    out.push({
      key,
      name_en,
      name_sr:         optional(r.cells, 'name_sr'),
      description_en:  optional(r.cells, 'description_en'),
      description_sr:  optional(r.cells, 'description_sr'),
      base_price,
      currency:        optional(r.cells, 'currency')?.toUpperCase().slice(0, 3) ?? null,
      sku:             optional(r.cells, 'sku'),
      unit_of_measure: optional(r.cells, 'unit_of_measure'),
      status,
      class_keys:      splitCsv(r.cells['class_keys']),
    })
  }
  return out
}

function parseTexts(rows: RawRow[], errors: ImportError[]): ParsedText[] {
  const out: ParsedText[] = []
  for (const r of rows) {
    const ctx = { sheet: SHEET_NAMES.texts, row: r.excelRow, errors }
    const level = required(r.cells, 'level', ctx)
    const slot = required(r.cells, 'slot', ctx)
    const language_raw = required(r.cells, 'language', ctx)
    const content = required(r.cells, 'content', ctx)
    if (!level || !slot || !language_raw || !content) continue

    if (level !== 'tenant') {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'level',
        message: `Only "tenant" is supported in this template. Set per-product/characteristic/value translations using the inline _en / _sr columns on those sheets.` })
      continue
    }

    const lang = language_raw.toLowerCase() as TextLanguage
    if (!(TEXT_LANGUAGES as readonly string[]).includes(lang)) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'language',
        message: `Invalid language "${language_raw}". Allowed: ${TEXT_LANGUAGES.join(', ')}` })
      continue
    }

    out.push({
      level:      'tenant',
      slot,
      language:   lang,
      content,
      sort_order: parseOptionalInt(r.cells, 'sort_order', ctx),
    })
  }
  return out
}

function parseSpecifications(rows: RawRow[], errors: ImportError[]): ParsedSpecification[] {
  const out: ParsedSpecification[] = []
  const allowedLevels: SpecificationLevel[] = ['product', 'characteristic', 'characteristic_value']

  for (const r of rows) {
    const ctx = { sheet: SHEET_NAMES.specifications, row: r.excelRow, errors }
    const level_raw    = required(r.cells, 'level', ctx)
    const reference_key = required(r.cells, 'reference_key', ctx)
    const slot         = required(r.cells, 'slot', ctx)
    const language_raw = required(r.cells, 'language', ctx)
    const content      = required(r.cells, 'content', ctx)
    if (!level_raw || !reference_key || !slot || !language_raw || !content) continue

    const level = level_raw.toLowerCase() as SpecificationLevel
    if (!allowedLevels.includes(level)) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'level',
        message: `Invalid level "${level_raw}". Allowed: ${allowedLevels.join(', ')}` })
      continue
    }

    const allowedSlots = SPECIFICATION_SLOTS[level]
    if (!allowedSlots.includes(slot)) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'slot',
        message: `Invalid slot "${slot}" for level "${level}". Allowed: ${allowedSlots.join(', ')}` })
      continue
    }

    const lang = language_raw.toLowerCase() as TextLanguage
    if (!(TEXT_LANGUAGES as readonly string[]).includes(lang)) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'language',
        message: `Invalid language "${language_raw}". Allowed: ${TEXT_LANGUAGES.join(', ')}` })
      continue
    }

    // Only product-level slots are multi-row. Characteristic & value
    // specifications must stay at sort_order = 0.
    const sort_order = parseOptionalInt(r.cells, 'sort_order', ctx)
    if (level !== 'product' && sort_order != null && sort_order !== 0) {
      errors.push({ sheet: ctx.sheet, row: r.excelRow, column: 'sort_order',
        message: `sort_order must be 0 (or blank) for ${level} specifications — only product blocks are multi-line` })
      continue
    }

    out.push({ level, reference_key, slot, language: lang, sort_order, content })
  }
  return out
}

// ── Validation primitives ───────────────────────────────────────────────────

function required(cells: Record<string, string>, name: string, ctx: { sheet: string; row: number; errors: ImportError[] }): string {
  const v = (cells[name] ?? '').trim()
  if (v.length === 0) {
    ctx.errors.push({ sheet: ctx.sheet, row: ctx.row, column: name, message: `Required value missing` })
  }
  return v
}

function optional(cells: Record<string, string>, name: string): string | null {
  const v = (cells[name] ?? '').trim()
  return v.length > 0 ? v : null
}

function parseOptionalInt(cells: Record<string, string>, name: string, ctx: { sheet: string; row: number; errors: ImportError[] }): number | null {
  const v = (cells[name] ?? '').trim()
  if (v.length === 0) return null
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    ctx.errors.push({ sheet: ctx.sheet, row: ctx.row, column: name, message: `Invalid integer "${v}"` })
    return null
  }
  return n
}

function splitCsv(v: string | undefined): string[] {
  if (!v) return []
  return v.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

function checkKeyUniqueness<T extends { key: string }>(sheet: string, rows: T[], errors: ImportError[]): void {
  const seen = new Map<string, number>()
  rows.forEach((r, idx) => {
    if (seen.has(r.key)) {
      errors.push({
        sheet, row: rowNumberOf(idx), column: 'key',
        message: `Duplicate key "${r.key}" — first seen at row ${rowNumberOf(seen.get(r.key)!)}`,
      })
    } else {
      seen.set(r.key, idx)
    }
  })
}

/** Excel row number for a 0-based index into parsed rows. The template
 *  reserves row 1 for instructions and row 2 for headers, so the first
 *  data row is row 3. This is the number we surface in error messages. */
function rowNumberOf(idx: number): number {
  return idx + 3
}
