import { describe, it, expect, vi } from 'vitest'

// `@/lib/quotations` transitively imports `@/lib/supabase` which throws when
// VITE_SUPABASE_URL is unset. Existing tests mock the supabase module to
// short-circuit that (see e.g. src/__tests__/billing.test.ts:4–8).
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import {
  tenant, quotation, texts, assets, expected,
} from '@/__fixtures__/quotationFixture'
import type {
  QuotationLineItem, QuotationAdjustment,
} from '@/types/database'
import { calcLineTotal, calcSubtotal, calcTotal } from '@/lib/quotations'

const lineItems   = quotation.line_items  as unknown as QuotationLineItem[]
const adjustments = quotation.adjustments as unknown as QuotationAdjustment[]

describe('quotationFixture', () => {
  it('has two line items', () => {
    expect(lineItems).toHaveLength(2)
    expect(lineItems[0].product_name).toBe('Studio Desk 140')
    expect(lineItems[1].product_name).toBe('Office Chair Pro')
  })

  it('each line item has a non-empty configuration', () => {
    for (const li of lineItems) {
      expect(li.configuration.length).toBeGreaterThan(0)
    }
  })

  it('contains EN and SR tenant_texts at every level used', () => {
    const seen = new Set(texts.map(t => `${t.level}:${t.slot}:${t.language}`))
    expect(seen.has('tenant:terms_line:en')).toBe(true)
    expect(seen.has('tenant:terms_line:sr')).toBe(true)
    expect(seen.has('product:description:en')).toBe(true)
    expect(seen.has('product:description:sr')).toBe(true)
    expect(seen.has('characteristic:description:en')).toBe(true)
    expect(seen.has('characteristic_value:specification:en')).toBe(true)
  })

  it('has visualization assets for every product (default image + at least one value image)', () => {
    expect(assets.length).toBeGreaterThanOrEqual(4)
    const defaults = assets.filter(a => a.characteristic_value_id === null)
    expect(defaults).toHaveLength(2)
  })

  it('precomputed totals match calcSubtotal/calcTotal', () => {
    const subtotal = calcSubtotal(lineItems)
    const total    = calcTotal(subtotal, adjustments)
    expect(subtotal).toBeCloseTo(expected.subtotal, 2)
    expect(total).toBeCloseTo(expected.total, 2)
    expect(quotation.subtotal).toBeCloseTo(subtotal, 2)
    expect(quotation.total_price).toBeCloseTo(total, 2)
  })

  it('desk line total matches the documented breakdown', () => {
    const desk = lineItems[0]
    const lineTotal = calcLineTotal(desk)
    expect(lineTotal).toBeCloseTo(expected.desk.lineTotal, 2)
  })

  it('tenant has no logo_url in v1 (browser-globals path is dodged)', () => {
    expect(tenant.logo_url).toBeNull()
  })
})
