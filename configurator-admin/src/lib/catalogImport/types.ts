import type { DisplayType, ProductStatus } from '@/types/database'

export const SHEET_NAMES = {
  classes:         'Classes',
  characteristics: 'Characteristics',
  values:          'Values',
  products:        'Products',
  translations:    'Translations',
  texts:           'Texts',
  specifications:  'Specifications',
  slots:           'Slots',
} as const

export const DISPLAY_TYPES: readonly DisplayType[] = [
  'select', 'radio', 'swatch', 'toggle', 'number', 'boolean',
]

export const PRODUCT_STATUSES: readonly ProductStatus[] = ['draft', 'published', 'archived']

export const TEXT_LANGUAGES = ['en', 'sr'] as const
export type TextLanguage = typeof TEXT_LANGUAGES[number]

// ── Entity sheets (structural columns only — translations live in Translations) ──

export interface ParsedClass {
  key:        string
  sort_order: number | null
}

export interface ParsedCharacteristic {
  key:          string
  display_type: DisplayType
  class_keys:   string[]
  sort_order:   number | null
}

export interface ParsedValue {
  key:                string
  characteristic_key: string
  price_modifier:     number
  hex_color:          string | null
  sort_order:         number | null
}

export interface ParsedProduct {
  key:             string
  base_price:      number
  currency:        string | null
  sku:             string | null
  unit_of_measure: string | null
  status:          ProductStatus
  class_keys:      string[]
}

// ── Translations sheet (name / description / label) ──────────────────────────

/** Levels you can target from the Translations sheet. tenant goes through the
 *  separate Texts sheet (it has no entity reference). */
export type TranslationLevel = 'class' | 'characteristic' | 'characteristic_value' | 'product'

export interface ParsedTranslation {
  level:         TranslationLevel
  reference_key: string
  slot:          string
  language:      TextLanguage
  content:       string
}

/** Single-row slots accepted on the Translations sheet, per level. */
export const TRANSLATION_SLOTS: Record<TranslationLevel, readonly string[]> = {
  class:                ['name'],
  characteristic:       ['name', 'description'],
  characteristic_value: ['label', 'description'],
  product:              ['name', 'description'],
}

/** The canonical-EN slot for each level. Every entity must have a row in the
 *  Translations sheet with language='en' and slot equal to this — that text
 *  is what populates the `.name` (or `.label`) column on the underlying
 *  table, used as the universal fallback. */
export const CANONICAL_NAME_SLOT: Record<TranslationLevel, string> = {
  class:                'name',
  characteristic:       'name',
  characteristic_value: 'label',
  product:              'name',
}

// ── Tenant-level texts sheet (unchanged) ─────────────────────────────────────

export interface ParsedText {
  level:      'tenant'
  slot:       string
  language:   TextLanguage
  content:    string
  sort_order: number | null
}

/** Tenant-level slots accepted on the Texts sheet. Some are single-row
 *  (pdf_footer, public_page_title), others are multi-row (terms_line, etc.). */
export const TENANT_TEXT_SLOTS: readonly string[] = [
  'pdf_footer',
  'public_page_title',
  'post_inquiry_message',
  'quotation_email_intro',
  'quotation_accept_message',
  'quotation_reject_message',
  'terms_line',
  'product', 'specification', 'note', 'terms',
]

// ── Specifications sheet (multi-row text blocks + spec slots) ────────────────

export type SpecificationLevel = 'product' | 'characteristic' | 'characteristic_value'

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

// ── Payload ──────────────────────────────────────────────────────────────────

export interface CatalogImportPayload {
  classes:         ParsedClass[]
  characteristics: ParsedCharacteristic[]
  values:          ParsedValue[]
  products:        ParsedProduct[]
  translations:    ParsedTranslation[]
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
  translations_created:    number
  texts_created:           number
  specifications_created:  number
}
