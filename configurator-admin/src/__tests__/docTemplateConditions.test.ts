import { describe, it, expect, vi } from 'vitest'
// context.ts → quotations.ts → supabase.ts throws without env vars; mock it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { evaluateCondition } from '@/lib/docTemplate/conditions'
import { buildTemplateContext } from '@/lib/docTemplate/context'
import type { ScopeStack } from '@/lib/docTemplate/resolvePath'
import { resolveCollection } from '@/lib/docTemplate/resolvePath'
import type { Condition } from '@/lib/docTemplate/types'
import { quotation, tenant, texts } from '@/__fixtures__/quotationFixture'

const ctx = buildTemplateContext(quotation, tenant, texts, 'en')
const root: ScopeStack = []

function ev(c: Condition | undefined, scope: ScopeStack = root): boolean {
  return evaluateCondition(c, ctx, scope)
}

describe('evaluateCondition — comparison ops', () => {
  it('undefined condition is always visible', () => {
    expect(ev(undefined)).toBe(true)
  })

  it('is-empty / not-empty on a populated field', () => {
    expect(ev({ type: 'cmp', field: 'quotation.notes', op: 'not-empty' })).toBe(true)
    expect(ev({ type: 'cmp', field: 'quotation.notes', op: 'is-empty' })).toBe(false)
  })

  it('is-empty / not-empty on a missing field', () => {
    // delivery_address is null in the fixture.
    expect(ev({ type: 'cmp', field: 'quotation.delivery_address', op: 'is-empty' })).toBe(true)
    expect(ev({ type: 'cmp', field: 'quotation.delivery_address', op: 'not-empty' })).toBe(false)
  })

  it('eq / neq on strings', () => {
    expect(ev({ type: 'cmp', field: 'quotation.currency', op: 'eq', value: 'EUR' })).toBe(true)
    expect(ev({ type: 'cmp', field: 'quotation.currency', op: 'eq', value: 'USD' })).toBe(false)
    expect(ev({ type: 'cmp', field: 'quotation.currency', op: 'neq', value: 'USD' })).toBe(true)
  })

  it('numeric gt / gte / lt / lte on totals', () => {
    // subtotal = 2800
    expect(ev({ type: 'cmp', field: 'quotation.subtotal', op: 'gt',  value: 1000 })).toBe(true)
    expect(ev({ type: 'cmp', field: 'quotation.subtotal', op: 'gte', value: 2800 })).toBe(true)
    expect(ev({ type: 'cmp', field: 'quotation.subtotal', op: 'lt',  value: 2800 })).toBe(false)
    expect(ev({ type: 'cmp', field: 'quotation.subtotal', op: 'lte', value: 2800 })).toBe(true)
  })

  it('numeric eq treats "2800" and 2800 alike', () => {
    expect(ev({ type: 'cmp', field: 'quotation.subtotal', op: 'eq', value: 2800 })).toBe(true)
    expect(ev({ type: 'cmp', field: 'quotation.subtotal', op: 'eq', value: '2800' })).toBe(true)
  })

  it('comparison against non-numeric operand is false', () => {
    expect(ev({ type: 'cmp', field: 'quotation.customer_name', op: 'gt', value: 5 })).toBe(false)
  })

  it('unknown field resolves empty → false for value comparisons', () => {
    expect(ev({ type: 'cmp', field: 'quotation.does_not_exist', op: 'not-empty' })).toBe(false)
    expect(ev({ type: 'cmp', field: 'quotation.does_not_exist', op: 'is-empty' })).toBe(true)
  })
})

describe('evaluateCondition — and / or nesting', () => {
  const t: Condition = { type: 'cmp', field: 'quotation.currency', op: 'eq', value: 'EUR' }
  const f: Condition = { type: 'cmp', field: 'quotation.currency', op: 'eq', value: 'USD' }

  it('and: all true', () => {
    expect(ev({ type: 'and', clauses: [t, t] })).toBe(true)
  })
  it('and: one false', () => {
    expect(ev({ type: 'and', clauses: [t, f] })).toBe(false)
  })
  it('or: one true', () => {
    expect(ev({ type: 'or', clauses: [f, t] })).toBe(true)
  })
  it('or: all false', () => {
    expect(ev({ type: 'or', clauses: [f, f] })).toBe(false)
  })
  it('empty and is true, empty or is false', () => {
    expect(ev({ type: 'and', clauses: [] })).toBe(true)
    expect(ev({ type: 'or',  clauses: [] })).toBe(false)
  })
  it('nested and/or', () => {
    const nested: Condition = {
      type: 'or',
      clauses: [f, { type: 'and', clauses: [t, { type: 'cmp', field: 'quotation.subtotal', op: 'gt', value: 0 }] }],
    }
    expect(ev(nested)).toBe(true)
  })
})

describe('evaluateCondition — scoped fields inside repeaters', () => {
  it('config_item fields resolve against the current loop frame', () => {
    const lineItems = resolveCollection(ctx, root, 'quotation.line_items')
    const deskFrame = lineItems[0] // Studio Desk
    const configRows = resolveCollection(ctx, [deskFrame], 'line_item.configuration')
    const oakScope: ScopeStack = [deskFrame, configRows[0]] // Material = Oak

    expect(ev({ type: 'cmp', field: 'config_item.value_label', op: 'eq', value: 'Oak' }, oakScope)).toBe(true)
    // price_modifier of Oak is 60
    expect(ev({ type: 'cmp', field: 'config_item.price_modifier', op: 'gt', value: 0 }, oakScope)).toBe(true)
  })

  it('out-of-scope config_item field at root resolves empty', () => {
    expect(ev({ type: 'cmp', field: 'config_item.value_label', op: 'not-empty' }, root)).toBe(false)
  })
})
