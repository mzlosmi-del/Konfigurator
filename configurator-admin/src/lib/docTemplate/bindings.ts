// Authoritative catalogue of every bindable field path for document templates.
//
// Modeled on `textSlots.ts` TEXT_SLOT_META: a flat, hand-maintained list that
// the builder's pickers read from (so authors can never reference an invalid
// path) and the renderers/condition evaluator resolve against (see context.ts
// + resolvePath.ts).
//
// SCOPE MODEL (scoped roots):
//   - `quotation.*` and `tenant.*` are always available.
//   - `line_item.*` is valid only inside a repeater over `quotation.line_items`.
//   - `config_item.*` is valid only inside a repeater over `line_item.configuration`.
// The catalogue marks each field's scope; the builder shows a field only when
// its scope is active at the selected block's tree position.

import type { Lang } from '@/i18n'

export type BindingScope = 'quotation' | 'tenant' | 'line_item' | 'config_item'
export type BindingType  = 'string' | 'number' | 'date' | 'currency' | 'image'

export interface BindingField {
  path:        string
  // EN is required and acts as the fallback; other languages are optional.
  label:       { en: string } & Partial<Record<Lang, string>>
  type:        BindingType
  scope:       BindingScope
  /** True when this path is a loopable collection (used by repeaters). */
  collection?: boolean
}

export const BINDINGS: BindingField[] = [
  // ── Quotation scope ───────────────────────────────────────────────────────
  { path: 'quotation.reference_number', label: { en: 'Reference number', sr: 'Broj reference' }, type: 'string', scope: 'quotation' },
  { path: 'quotation.title',            label: { en: 'Title',            sr: 'Naslov' },          type: 'string', scope: 'quotation' },
  { path: 'quotation.customer_name',    label: { en: 'Customer name',    sr: 'Ime kupca' },       type: 'string', scope: 'quotation' },
  { path: 'quotation.customer_company', label: { en: 'Customer company', sr: 'Firma kupca' },     type: 'string', scope: 'quotation' },
  { path: 'quotation.customer_email',   label: { en: 'Customer email',   sr: 'E-mail kupca' },    type: 'string', scope: 'quotation' },
  { path: 'quotation.customer_phone',   label: { en: 'Customer phone',   sr: 'Telefon kupca' },   type: 'string', scope: 'quotation' },
  { path: 'quotation.customer_address', label: { en: 'Customer address', sr: 'Adresa kupca' },    type: 'string', scope: 'quotation' },
  { path: 'quotation.customer_vat_number', label: { en: 'Customer VAT / Tax ID', sr: 'PIB kupca' }, type: 'string', scope: 'quotation' },
  { path: 'quotation.delivery_address', label: { en: 'Delivery address', sr: 'Adresa isporuke' }, type: 'string', scope: 'quotation' },
  { path: 'quotation.notes',            label: { en: 'Notes',            sr: 'Napomene' },         type: 'string', scope: 'quotation' },
  { path: 'quotation.payment_terms',    label: { en: 'Payment terms',    sr: 'Uslovi plaćanja' }, type: 'string', scope: 'quotation' },
  { path: 'quotation.currency',         label: { en: 'Currency',         sr: 'Valuta' },          type: 'string', scope: 'quotation' },
  { path: 'quotation.valid_until',      label: { en: 'Valid until',      sr: 'Važi do' },         type: 'date',   scope: 'quotation' },
  { path: 'quotation.created_at',       label: { en: 'Issue date',       sr: 'Datum izdavanja' }, type: 'date',   scope: 'quotation' },
  { path: 'quotation.subtotal',         label: { en: 'Subtotal',         sr: 'Međuzbir' },        type: 'currency', scope: 'quotation' },
  { path: 'quotation.total',            label: { en: 'Total',            sr: 'Ukupno' },          type: 'currency', scope: 'quotation' },
  { path: 'quotation.line_items',       label: { en: 'Line items',       sr: 'Stavke' },          type: 'string', scope: 'quotation', collection: true },

  // ── Tenant scope ──────────────────────────────────────────────────────────
  { path: 'tenant.name',               label: { en: 'Company name',    sr: 'Naziv firme' },     type: 'string', scope: 'tenant' },
  { path: 'tenant.company_address',    label: { en: 'Company address', sr: 'Adresa firme' },    type: 'string', scope: 'tenant' },
  { path: 'tenant.company_phone',      label: { en: 'Company phone',   sr: 'Telefon firme' },   type: 'string', scope: 'tenant' },
  { path: 'tenant.company_email',      label: { en: 'Company email',   sr: 'E-mail firme' },    type: 'string', scope: 'tenant' },
  { path: 'tenant.company_website',    label: { en: 'Company website', sr: 'Veb-sajt firme' },  type: 'string', scope: 'tenant' },
  { path: 'tenant.contact_person',     label: { en: 'Contact person',  sr: 'Kontakt osoba' },   type: 'string', scope: 'tenant' },
  { path: 'tenant.vat_number',         label: { en: 'VAT number',      sr: 'PDV broj' },        type: 'string', scope: 'tenant' },
  { path: 'tenant.company_reg_number', label: { en: 'Reg. number',     sr: 'Matični broj' },    type: 'string', scope: 'tenant' },
  { path: 'tenant.logo_url',           label: { en: 'Logo',            sr: 'Logo' },            type: 'image',  scope: 'tenant' },

  // ── Line-item scope (inside a quotation.line_items repeater) ────────────────
  { path: 'line_item.product_name',    label: { en: 'Product name',     sr: 'Naziv proizvoda' },  type: 'string', scope: 'line_item' },
  { path: 'line_item.product_sku',     label: { en: 'Product SKU',      sr: 'Šifra proizvoda' },  type: 'string', scope: 'line_item' },
  { path: 'line_item.unit_of_measure', label: { en: 'Unit of measure',  sr: 'Jedinica mere' },    type: 'string', scope: 'line_item' },
  { path: 'line_item.quantity',        label: { en: 'Quantity',         sr: 'Količina' },         type: 'number', scope: 'line_item' },
  { path: 'line_item.unit_price',      label: { en: 'Unit price',       sr: 'Jedinična cena' },   type: 'currency', scope: 'line_item' },
  { path: 'line_item.line_total',      label: { en: 'Line total',       sr: 'Ukupno za stavku' }, type: 'currency', scope: 'line_item' },
  { path: 'line_item.product_image',   label: { en: 'Product image',    sr: 'Slika proizvoda' },  type: 'image',  scope: 'line_item' },
  { path: 'line_item.specification',   label: { en: 'Product specification', sr: 'Specifikacija proizvoda' }, type: 'string', scope: 'line_item' },
  { path: 'line_item.configuration',   label: { en: 'Configuration',    sr: 'Konfiguracija' },    type: 'string', scope: 'line_item', collection: true },

  // ── Config-item scope (inside a line_item.configuration repeater) ───────────
  { path: 'config_item.characteristic_name', label: { en: 'Characteristic name', sr: 'Naziv karakteristike' }, type: 'string', scope: 'config_item' },
  { path: 'config_item.value_label',         label: { en: 'Selected value',      sr: 'Izabrana vrednost' },    type: 'string', scope: 'config_item' },
  { path: 'config_item.description',         label: { en: 'Description',         sr: 'Opis' },                 type: 'string', scope: 'config_item' },
  { path: 'config_item.specification',       label: { en: 'Specification',       sr: 'Specifikacija' },        type: 'string', scope: 'config_item' },
  { path: 'config_item.price_modifier',      label: { en: 'Price modifier',      sr: 'Doplata' },              type: 'currency', scope: 'config_item' },
  { path: 'config_item.value_image',         label: { en: 'Value image',         sr: 'Slika vrednosti' },      type: 'image',  scope: 'config_item' },
]

const BY_PATH: Record<string, BindingField> = Object.fromEntries(BINDINGS.map(b => [b.path, b]))

export function bindingField(path: string): BindingField | undefined {
  return BY_PATH[path]
}

export function bindingLabel(path: string, lang: Lang): string {
  const f = BY_PATH[path]
  if (!f) return path
  return f.label[lang] || f.label.en || path
}

/** Scopes implied by a collection path, used to decide which fields a repeater
 *  makes available to its children. */
export function scopeForCollection(over: string): BindingScope | null {
  if (over === 'quotation.line_items')     return 'line_item'
  if (over === 'line_item.configuration')  return 'config_item'
  return null
}

/** Fields visible given the set of active scopes at a tree position. Tenant and
 *  quotation are always active; line_item / config_item are added by enclosing
 *  repeaters. */
export function fieldsForScopes(active: Set<BindingScope>, opts?: { type?: BindingType; collectionsOnly?: boolean }): BindingField[] {
  return BINDINGS.filter(b => {
    if (!active.has(b.scope)) return false
    if (opts?.collectionsOnly && !b.collection) return false
    if (opts?.type && b.type !== opts.type) return false
    return true
  })
}

/** The always-available base scopes. */
export const BASE_SCOPES: BindingScope[] = ['quotation', 'tenant']
