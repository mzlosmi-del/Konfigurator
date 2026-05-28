import type { DisplayType, ProductStatus } from '@/types/database'

export const SHEET_NAMES = {
  classes:         'Classes',
  characteristics: 'Characteristics',
  values:          'Values',
  products:        'Products',
  texts:           'Texts',
  specifications:  'Specifications',
} as const

export const DISPLAY_TYPES: readonly DisplayType[] = [
  'select', 'radio', 'swatch', 'toggle', 'number', 'boolean',
]

export const PRODUCT_STATUSES: readonly ProductStatus[] = ['draft', 'published', 'archived']

export const TEXT_LANGUAGES = ['en', 'sr'] as const
export type TextLanguage = typeof TEXT_LANGUAGES[number]

export interface ParsedClass {
  key:        string
  name_en:    string
  name_sr:    string | null
  sort_order: number | null
}

export interface ParsedCharacteristic {
  key:             string
  name_en:         string
  name_sr:         string | null
  description_en:  string | null
  description_sr:  string | null
  display_type:    DisplayType
  class_keys:      string[]
  sort_order:      number | null
}

export interface ParsedValue {
  key:                string
  characteristic_key: string
  label_en:           string
  label_sr:           string | null
  price_modifier:     number
  hex_color:          string | null
  sort_order:         number | null
}

export interface ParsedProduct {
  key:             string
  name_en:         string
  name_sr:         string | null
  description_en:  string | null
  description_sr: string | null
  base_price:      number
  currency:        string | null
  sku:             string | null
  unit_of_measure: string | null
  status:          ProductStatus
  class_keys:      string[]
}

export interface ParsedText {
  level:      'tenant'
  slot:       string
  language:   TextLanguage
  content:    string
  sort_order: number | null
}

/** Levels that the Specifications sheet can target. Tenant-level multi-row
 *  slots (terms_line, etc.) still live in the Texts sheet. */
export type SpecificationLevel = 'product' | 'characteristic' | 'characteristic_value'

/** Allowed slot values per level on the Specifications sheet. Mirrors the
 *  TEXT_SLOTS catalogue but restricted to multi-row / spec slots we're
 *  exposing for bulk import. */
export const SPECIFICATION_SLOTS: Record<SpecificationLevel, readonly string[]> = {
  product:              ['specification', 'product', 'note', 'terms'],
  characteristic:       ['specification'],
  characteristic_value: ['specification'],
}

export interface ParsedSpecification {
  level:         SpecificationLevel
  reference_key: string
  slot:          string
  language:      TextLanguage
  sort_order:    number | null
  content:       string
}

export interface CatalogImportPayload {
  classes:         ParsedClass[]
  characteristics: ParsedCharacteristic[]
  values:          ParsedValue[]
  products:        ParsedProduct[]
  texts:           ParsedText[]
  specifications:  ParsedSpecification[]
}

export interface ImportError {
  /** Sheet name where the error was found, e.g. 'Products'. `null` for
   *  workbook-wide errors (e.g. missing required sheet). */
  sheet:   string | null
  /** 1-based row number as it appears in Excel (instructions row = 1,
   *  header row = 2, first data row = 3). `null` for sheet-level errors. */
  row:     number | null
  /** Offending column header, when applicable. */
  column:  string | null
  message: string
}

export interface ParseResult {
  payload: CatalogImportPayload
  errors:  ImportError[]
}

export interface ImportResult {
  classes_created:         number
  characteristics_created: number
  values_created:          number
  products_created:        number
  texts_created:           number
  specifications_created:  number
}
