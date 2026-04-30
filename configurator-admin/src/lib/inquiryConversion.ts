// Helpers for converting an inquiry into a draft quotation. Pure functions —
// the caller is responsible for fetching the inquiry, the product, and the
// product's characteristics (with values) before invoking these.

import type { Inquiry, Product, QuotationConfigItem } from '@/types/database'
import type { CharacteristicWithValues } from './products'

// Shape stored in inquiries.configuration JSONB (snapshot, no IDs).
// Defined inline here to avoid coupling to widget types.
export interface InquiryConfigItem {
  characteristic_name: string
  value_label:         string
  price_modifier:      number
}

export interface ParsedMessage {
  phone:   string | null
  company: string | null
  notes:   string | null
}

/**
 * The widget concatenates phone/company into the message field as
 * `Phone: ...` / `Company: ...` lines (see configurator-widget InquiryForm.tsx).
 * Pull those back out and return the leftover free text as `notes`.
 */
export function parseInquiryMessage(msg: string | null): ParsedMessage {
  if (!msg) return { phone: null, company: null, notes: null }
  const lines = msg.split(/\r?\n/)
  let phone: string | null = null
  let company: string | null = null
  const rest: string[] = []
  for (const line of lines) {
    const m = line.match(/^\s*(Phone|Company)\s*:\s*(.*)$/i)
    if (m) {
      const key = m[1].toLowerCase()
      const val = m[2].trim()
      if (!val) continue
      if (key === 'phone'   && phone   === null) { phone   = val; continue }
      if (key === 'company' && company === null) { company = val; continue }
    }
    rest.push(line)
  }
  const notes = rest.join('\n').trim()
  return { phone, company, notes: notes || null }
}

export interface MappedConfig {
  config:  QuotationConfigItem[]
  dropped: string[]   // human-readable labels of items that could not be matched
}

/**
 * Map an inquiry's snapshot configuration back to QuotationConfigItem[] by
 * looking up the matching characteristic + value IDs in the product's current
 * characteristic list. Items that no longer exist (renamed or deleted) are
 * skipped and surfaced via `dropped` so the caller can warn the admin.
 */
export function mapInquiryConfiguration(
  inquiryConfig: InquiryConfigItem[],
  characteristics: CharacteristicWithValues[],
): MappedConfig {
  const config:  QuotationConfigItem[] = []
  const dropped: string[]              = []

  for (const item of inquiryConfig) {
    const char = characteristics.find(
      c => c.name.trim().toLowerCase() === item.characteristic_name.trim().toLowerCase(),
    )
    if (!char) {
      dropped.push(`${item.characteristic_name}: ${item.value_label}`)
      continue
    }
    const value = char.characteristic_values.find(
      v => v.label.trim().toLowerCase() === item.value_label.trim().toLowerCase(),
    )
    if (!value) {
      dropped.push(`${item.characteristic_name}: ${item.value_label}`)
      continue
    }
    config.push({
      characteristic_id:   char.id,
      characteristic_name: char.name,
      value_id:            value.id,
      value_label:         value.label,
      price_modifier:      Number(value.price_modifier),
    })
  }

  return { config, dropped }
}

export interface QuotationDraftFromInquiry {
  customer_name:    string
  customer_email:   string
  customer_phone:   string | null
  customer_company: string | null
  customer_address: string | null
  notes:            string | null
  currency:         string
  source_inquiry_id: string
  product_id:       string
  selection:        Record<string, string>   // charId → valueId
  dropped:          string[]
}

/**
 * Compose everything into a draft ready to hydrate the QuotationFormPage.
 * Returns the customer fields + a single line-item `selection` keyed by
 * characteristic id (the same shape the form's LineItemDraft uses).
 */
export function inquiryToQuotationDraft(
  inquiry: Inquiry,
  product: Product,
  characteristics: CharacteristicWithValues[],
): QuotationDraftFromInquiry {
  const parsed = parseInquiryMessage(inquiry.message)
  const inqConfig = (Array.isArray(inquiry.configuration) ? inquiry.configuration : []) as unknown as InquiryConfigItem[]
  const { config, dropped } = mapInquiryConfiguration(inqConfig, characteristics)

  const selection: Record<string, string> = {}
  for (const c of config) selection[c.characteristic_id] = c.value_id

  return {
    customer_name:    inquiry.customer_name,
    customer_email:   inquiry.customer_email,
    customer_phone:   parsed.phone,
    customer_company: parsed.company,
    customer_address: null,            // not captured by the inquiry form
    notes:            parsed.notes,
    currency:         inquiry.currency,
    source_inquiry_id: inquiry.id,
    product_id:       product.id,
    selection,
    dropped,
  }
}
