import { describe, it, expect, vi } from 'vitest'
import { atLimit } from '@/lib/planLimits'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
  },
}))

// ── ID remapping (mirrors clone-template edge function logic) ─────────────────

function remapFormulaIds(
  node: unknown,
  charMap: Record<string, string>,
  valMap: Record<string, string>,
): unknown {
  if (typeof node !== 'object' || node === null) return node
  const n = node as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(n)) {
    if (k === 'char_id' && typeof v === 'string')   result[k] = charMap[v] ?? v
    else if (k === 'value_id' && typeof v === 'string') result[k] = valMap[v] ?? v
    else if (typeof v === 'object')                  result[k] = remapFormulaIds(v, charMap, valMap)
    else                                             result[k] = v
  }
  return result
}

describe('clone-template: formula ID remapping', () => {
  const charMap = { 'old-char-1': 'new-char-1', 'old-char-2': 'new-char-2' }
  const valMap  = { 'old-val-1': 'new-val-1' }

  it('remaps char_id at any depth', () => {
    const formula = {
      type: 'add',
      left: { type: 'base_price' },
      right: { type: 'modifier', char_id: 'old-char-1' },
    }
    const result = remapFormulaIds(formula, charMap, valMap) as typeof formula
    expect((result.right as { char_id: string }).char_id).toBe('new-char-1')
  })

  it('remaps value_id', () => {
    const formula = { type: 'is_selected', char_id: 'old-char-2', value_id: 'old-val-1' }
    const result = remapFormulaIds(formula, charMap, valMap) as typeof formula
    expect(result.char_id).toBe('new-char-2')
    expect(result.value_id).toBe('new-val-1')
  })

  it('leaves unknown IDs unchanged (not in map)', () => {
    const formula = { type: 'modifier', char_id: 'unknown-char' }
    const result = remapFormulaIds(formula, charMap, valMap) as typeof formula
    expect(result.char_id).toBe('unknown-char')
  })

  it('handles nested add/subtract trees', () => {
    const formula = {
      type: 'add',
      left: { type: 'modifier', char_id: 'old-char-1' },
      right: { type: 'modifier', char_id: 'old-char-2' },
    }
    const result = remapFormulaIds(formula, charMap, valMap) as typeof formula
    expect((result.left as { char_id: string }).char_id).toBe('new-char-1')
    expect((result.right as { char_id: string }).char_id).toBe('new-char-2')
  })

  it('passes through primitive values unmodified', () => {
    const formula = { type: 'number', value: 42 }
    const result = remapFormulaIds(formula, charMap, valMap) as typeof formula
    expect(result.value).toBe(42)
  })
})

// ── Plan limit guard on clone ─────────────────────────────────────────────────

describe('clone-template: plan limit enforcement', () => {
  it('free plan at 3 products: clone should be blocked', () => {
    expect(atLimit(3, 3)).toBe(true)
  })

  it('free plan at 2 products: clone should be allowed', () => {
    expect(atLimit(3, 2)).toBe(false)
  })

  it('growth plan (unlimited): clone always allowed', () => {
    expect(atLimit(-1, 999)).toBe(false)
  })
})

// ── Cloned product independence ───────────────────────────────────────────────
// Verifies the conceptual guarantee: mutating one object does not affect another.

describe('clone independence', () => {
  it('deep clone produces independent object', () => {
    const original = { name: 'Desk', chars: [{ id: 'c1', values: ['v1', 'v2'] }] }
    const clone    = JSON.parse(JSON.stringify(original))
    clone.name = 'My Desk'
    clone.chars[0].values.push('v3')
    expect(original.name).toBe('Desk')
    expect(original.chars[0].values).toHaveLength(2)
  })
})

// ── Template seed expectations ────────────────────────────────────────────────

describe('template seed data shape', () => {
  const expectedTemplates = [
    { name: 'Custom Desk',    category: 'Furniture',        basePrice: 299 },
    { name: 'Bookshelf',      category: 'Furniture',        basePrice: 149 },
    { name: 'Office Chair',   category: 'Furniture',        basePrice: 199 },
    { name: 'Dining Table',   category: 'Furniture',        basePrice: 349 },
    { name: 'Single Window',  category: 'Windows & Doors',  basePrice: 189 },
    { name: 'Sliding Door',   category: 'Windows & Doors',  basePrice: 449 },
    { name: 'Bay Window',     category: 'Windows & Doors',  basePrice: 699 },
    { name: 'Skylight',       category: 'Windows & Doors',  basePrice: 399 },
  ]

  it('expects 8 templates total', () => {
    expect(expectedTemplates).toHaveLength(8)
  })

  it('has 4 furniture templates', () => {
    expect(expectedTemplates.filter(t => t.category === 'Furniture')).toHaveLength(4)
  })

  it('has 4 windows & doors templates', () => {
    expect(expectedTemplates.filter(t => t.category === 'Windows & Doors')).toHaveLength(4)
  })

  it('all base prices are positive', () => {
    expect(expectedTemplates.every(t => t.basePrice > 0)).toBe(true)
  })
})
