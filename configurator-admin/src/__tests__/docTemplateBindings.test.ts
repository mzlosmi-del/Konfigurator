import { describe, it, expect, vi } from 'vitest'
// context.ts → quotations.ts → supabase.ts throws without env vars; mock it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { buildTemplateContext } from '@/lib/docTemplate/context'
import { resolveDisplay, resolveCollection, interpolate, type ScopeStack } from '@/lib/docTemplate/resolvePath'
import { BINDINGS, fieldsForScopes, bindingField, type BindingScope } from '@/lib/docTemplate/bindings'
import { quotation, tenant, texts, expected } from '@/__fixtures__/quotationFixture'

const ctx = buildTemplateContext(quotation, tenant, texts, 'en')
const root: ScopeStack = []

describe('binding catalogue', () => {
  it('every path is unique', () => {
    const paths = BINDINGS.map(b => b.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('fieldsForScopes hides line_item/config_item fields at root scope', () => {
    const base = new Set<BindingScope>(['quotation', 'tenant'])
    const fields = fieldsForScopes(base)
    expect(fields.some(f => f.scope === 'line_item')).toBe(false)
    expect(fields.some(f => f.scope === 'config_item')).toBe(false)
    expect(fields.some(f => f.path === 'quotation.total')).toBe(true)
  })

  it('fieldsForScopes reveals line_item fields when that scope is active', () => {
    const active = new Set<BindingScope>(['quotation', 'tenant', 'line_item'])
    const fields = fieldsForScopes(active)
    expect(fields.some(f => f.path === 'line_item.product_name')).toBe(true)
    expect(fields.some(f => f.scope === 'config_item')).toBe(false)
  })

  it('collection filter returns only loopable fields', () => {
    const active = new Set<BindingScope>(['quotation', 'tenant', 'line_item'])
    const cols = fieldsForScopes(active, { collectionsOnly: true })
    expect(cols.map(c => c.path).sort()).toEqual(['line_item.configuration', 'quotation.line_items'])
  })
})

describe('resolveDisplay against the fixture', () => {
  it('plain quotation strings', () => {
    expect(resolveDisplay(ctx, root, 'quotation.reference_number')).toBe('Q-2026-0042')
    expect(resolveDisplay(ctx, root, 'quotation.customer_name')).toBe('Jovan Marković')
  })

  it('tenant strings', () => {
    expect(resolveDisplay(ctx, root, 'tenant.name')).toBe('Acme Furniture Workshop')
  })

  it('currency formatting uses the quotation currency', () => {
    // subtotal = 2800, total = 3124.8
    expect(resolveDisplay(ctx, root, 'quotation.subtotal')).toBe(`${expected.subtotal.toFixed(2)} EUR`)
    expect(resolveDisplay(ctx, root, 'quotation.total')).toBe(`${expected.total.toFixed(2)} EUR`)
  })

  it('missing field resolves to empty string', () => {
    expect(resolveDisplay(ctx, root, 'quotation.delivery_address')).toBe('')
  })

  it('image type field returns its URL string', () => {
    expect(bindingField('tenant.logo_url')?.type).toBe('image')
    expect(resolveDisplay(ctx, root, 'tenant.logo_url')).toBe('') // null logo in fixture
  })
})

describe('collection + scoped resolution', () => {
  it('quotation.line_items yields one frame per item', () => {
    const items = resolveCollection(ctx, root, 'quotation.line_items')
    expect(items).toHaveLength(2)
    expect(items[0].kind).toBe('line_item')
  })

  it('line_item fields resolve and compute line_total via quotations.ts', () => {
    const items = resolveCollection(ctx, root, 'quotation.line_items')
    const deskScope: ScopeStack = [items[0]]
    expect(resolveDisplay(ctx, deskScope, 'line_item.product_name')).toBe('Studio Desk 140')
    expect(resolveDisplay(ctx, deskScope, 'line_item.quantity')).toBe('2')
    expect(resolveDisplay(ctx, deskScope, 'line_item.line_total')).toBe(`${expected.desk.lineTotal.toFixed(2)} EUR`)
  })

  it('nested config_item resolution', () => {
    const items = resolveCollection(ctx, root, 'quotation.line_items')
    const deskScope: ScopeStack = [items[0]]
    const cfg = resolveCollection(ctx, deskScope, 'line_item.configuration')
    expect(cfg).toHaveLength(3)
    const oak: ScopeStack = [items[0], cfg[0]]
    expect(resolveDisplay(ctx, oak, 'config_item.characteristic_name')).toBe('Material')
    expect(resolveDisplay(ctx, oak, 'config_item.value_label')).toBe('Oak')
    // description resolved from the i18n snapshot on the line item
    expect(resolveDisplay(ctx, oak, 'config_item.description')).toBe('Solid hardwood top.')
  })

  it('specification bindings resolve from the specification slot', () => {
    const items = resolveCollection(ctx, root, 'quotation.line_items')
    const deskScope: ScopeStack = [items[0]] // Studio Desk
    // product-level specification slot (fixture: PROD_DESK specification en)
    expect(resolveDisplay(ctx, deskScope, 'line_item.specification'))
      .toBe('Dimensions: 140 × 70 × 75 cm. Net weight 38 kg.')
    // value-level specification slot (fixture: VAL_OAK specification en)
    const cfg = resolveCollection(ctx, deskScope, 'line_item.configuration')
    const oak: ScopeStack = [items[0], cfg[0]]
    expect(resolveDisplay(ctx, oak, 'config_item.specification'))
      .toBe('Oak: medium density, light golden grain.')
  })
})

describe('interpolate', () => {
  it('substitutes tokens and keeps literal text', () => {
    expect(interpolate('Quote {{quotation.reference_number}} for {{quotation.customer_name}}', ctx, root))
      .toBe('Quote Q-2026-0042 for Jovan Marković')
  })
  it('unknown tokens become empty', () => {
    expect(interpolate('x{{quotation.nope}}y', ctx, root)).toBe('xy')
  })
  it('resolves scoped tokens inside a line_item frame', () => {
    const items = resolveCollection(ctx, root, 'quotation.line_items')
    expect(interpolate('{{line_item.product_name}}', ctx, [items[1]])).toBe('Office Chair Pro')
  })
})
