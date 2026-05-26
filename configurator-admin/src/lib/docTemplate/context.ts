// Assemble ONE normalized, language-resolved data object that the renderers and
// the condition evaluator read by path. Built once per export from a quotation,
// its tenant profile, and the pre-fetched tenant_texts rows — reusing the
// existing texts.ts / quotations.ts helpers so totals and i18n stay canonical.

import type { Quotation, QuotationLineItem, QuotationConfigItem, QuotationAdjustment, TenantText } from '@/types/database'
import type { TenantProfile } from '@/lib/pdf/shared'
import type { Lang } from '@/i18n'
import { calcLineTotal, calcSubtotal, calcTotal } from '@/lib/quotations'
import { resolveText } from '@/lib/texts'
import { resolveCharDescription } from '@/lib/pdf/shared'

/** A configuration row, flattened for binding resolution. */
export interface ContextConfigItem {
  characteristic_name: string
  value_label:         string
  description:         string
  /** `specification` slot text — value-level, falling back to characteristic-level. */
  specification:       string
  price_modifier:      number
  /** Resolved image URL (value-level) or null. */
  value_image:         string | null
}

/** A line item, flattened for binding resolution. */
export interface ContextLineItem {
  product_name:    string
  product_sku:     string | null
  unit_of_measure: string | null
  quantity:        number
  unit_price:      number
  line_total:      number
  /** `specification` slot text at the product level. */
  specification:   string
  product_image:   string | null
  configuration:   ContextConfigItem[]
}

export interface TemplateContext {
  lang:     Lang
  currency: string
  quotation: {
    reference_number:    string | null
    title:               string | null
    customer_name:       string | null
    customer_company:    string | null
    customer_email:      string | null
    customer_phone:      string | null
    customer_address:    string | null
    customer_vat_number: string | null
    delivery_address:    string | null
    notes:               string | null
    payment_terms:       string | null
    currency:            string | null
    valid_until:         string | null
    created_at:          string | null
    subtotal:            number
    total:               number
    line_items:          ContextLineItem[]
  }
  tenant: {
    name:               string
    company_address:    string | null
    company_phone:      string | null
    company_email:      string | null
    company_website:    string | null
    contact_person:     string | null
    vat_number:         string | null
    company_reg_number: string | null
    logo_url:           string | null
  }
}

/** Optional map of `product_id` / `value_id` → image URL so image bindings can
 *  resolve. Callers that don't need images can omit it. */
export interface ImageResolver {
  productImage?: (productId: string) => string | null
  valueImage?:   (valueId: string) => string | null
}

export function buildTemplateContext(
  quotation: Quotation,
  tenant:    TenantProfile,
  texts:     TenantText[],
  lang:      Lang,
  images?:   ImageResolver,
): TemplateContext {
  const rawItems = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
  const adjs     = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const subtotal = calcSubtotal(rawItems)
  const total    = calcTotal(subtotal, adjs)

  const line_items: ContextLineItem[] = rawItems.map(li => ({
    product_name:    li.product_name,
    product_sku:     li.product_sku ?? null,
    unit_of_measure: li.unit_of_measure ?? null,
    quantity:        li.quantity,
    unit_price:      li.unit_price,
    line_total:      calcLineTotal(li),
    specification:   resolveText(texts, 'product', li.product_id, 'specification', lang),
    product_image:   images?.productImage?.(li.product_id) ?? null,
    configuration:   (li.configuration ?? []).map((c: QuotationConfigItem) => ({
      characteristic_name: c.characteristic_name,
      value_label:         c.value_label,
      // Prefer the snapshotted i18n description on the line item; fall back to
      // the central tenant_texts characteristic description for the language.
      description:
        resolveCharDescription(c.characteristic_description_i18n, lang) ||
        resolveText(texts, 'characteristic', c.characteristic_id, 'description', lang),
      // Value-level specification slot, falling back to characteristic-level.
      specification:
        resolveText(texts, 'characteristic_value', c.value_id, 'specification', lang) ||
        resolveText(texts, 'characteristic', c.characteristic_id, 'specification', lang),
      price_modifier:      c.price_modifier,
      value_image:         images?.valueImage?.(c.value_id) ?? null,
    })),
  }))

  return {
    lang,
    currency: quotation.currency ?? '',
    quotation: {
      reference_number:    quotation.reference_number ?? null,
      title:               quotation.title ?? null,
      customer_name:       quotation.customer_name ?? null,
      customer_company:    quotation.customer_company ?? null,
      customer_email:      quotation.customer_email ?? null,
      customer_phone:      quotation.customer_phone ?? null,
      customer_address:    quotation.customer_address ?? null,
      customer_vat_number: quotation.customer_vat_number ?? null,
      delivery_address:    quotation.delivery_address ?? null,
      notes:               quotation.notes ?? null,
      payment_terms:       quotation.payment_terms ?? null,
      currency:            quotation.currency ?? null,
      valid_until:         quotation.valid_until ?? null,
      created_at:          quotation.created_at ?? null,
      subtotal,
      total,
      line_items,
    },
    tenant: {
      name:               tenant.name,
      company_address:    tenant.company_address ?? null,
      company_phone:      tenant.company_phone ?? null,
      company_email:      tenant.company_email ?? null,
      company_website:    tenant.company_website ?? null,
      contact_person:     tenant.contact_person ?? null,
      vat_number:         tenant.vat_number ?? null,
      company_reg_number: tenant.company_reg_number ?? null,
      logo_url:           tenant.logo_url ?? null,
    },
  }
}
