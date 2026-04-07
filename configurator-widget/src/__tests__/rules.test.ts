import { describe, it, expect } from 'vitest'
import { evaluateRules, calculatePrice, sanitizeSelection } from '../rules'
import type { ConfigurationRule, Selection } from '../types'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const charMaterial = 'char-material'
const charSize     = 'char-size'
const valOak       = 'val-oak'
const valPine      = 'val-pine'
const valSmall     = 'val-small'
const valLarge     = 'val-large'

const hideRule: ConfigurationRule = {
  id: 'rule-1',
  rule_type: 'hide_value',
  condition: { characteristic_id: charMaterial, value_id: valPine },
  effect:    { characteristic_id: charSize,     value_id: valLarge },
  is_active: true,
}

const disableRule: ConfigurationRule = {
  id: 'rule-2',
  rule_type: 'disable_value',
  condition: { characteristic_id: charMaterial, value_id: valOak },
  effect:    { characteristic_id: charSize,     value_id: valSmall },
  is_active: true,
}

const priceOverrideRule: ConfigurationRule = {
  id: 'rule-3',
  rule_type: 'price_override',
  condition: { characteristic_id: charMaterial, value_id: valOak },
  effect:    { characteristic_id: charMaterial, price_modifier: 200 },
  is_active: true,
}

const chars = [
  { id: charMaterial, values: [{ id: valOak, price_modifier: 100 }, { id: valPine, price_modifier: 0 }] },
  { id: charSize,     values: [{ id: valSmall, price_modifier: 0 }, { id: valLarge, price_modifier: 50 }] },
]

// ─── evaluateRules ────────────────────────────────────────────────────────────

describe('evaluateRules', () => {
  it('returns empty effect when no rules match', () => {
    const selection: Selection = { [charMaterial]: valOak }
    const effect = evaluateRules([hideRule], selection)
    expect(effect.hiddenValues.size).toBe(0)
    expect(effect.disabledValues.size).toBe(0)
  })

  it('hides a value when condition is met', () => {
    const selection: Selection = { [charMaterial]: valPine }
    const effect = evaluateRules([hideRule], selection)
    expect(effect.hiddenValues.has(valLarge)).toBe(true)
    expect(effect.hiddenValues.size).toBe(1)
  })

  it('disables a value when condition is met', () => {
    const selection: Selection = { [charMaterial]: valOak }
    const effect = evaluateRules([disableRule], selection)
    expect(effect.disabledValues.has(valSmall)).toBe(true)
  })

  it('records a price override when condition is met', () => {
    const selection: Selection = { [charMaterial]: valOak }
    const effect = evaluateRules([priceOverrideRule], selection)
    expect(effect.priceOverrides[charMaterial]).toBe(200)
  })

  it('does not apply inactive rules', () => {
    const inactive = { ...hideRule, is_active: false }
    const selection: Selection = { [charMaterial]: valPine }
    const effect = evaluateRules([inactive], selection)
    expect(effect.hiddenValues.size).toBe(0)
  })
})

// ─── sanitizeSelection ────────────────────────────────────────────────────────

describe('sanitizeSelection', () => {
  it('removes a selected value that became hidden', () => {
    const selection: Selection = { [charMaterial]: valPine, [charSize]: valLarge }
    const effect = evaluateRules([hideRule], selection)
    const sanitized = sanitizeSelection(selection, effect)
    expect(sanitized[charSize]).toBeUndefined()
    expect(sanitized[charMaterial]).toBe(valPine)
  })

  it('removes a selected value that became disabled', () => {
    const selection: Selection = { [charMaterial]: valOak, [charSize]: valSmall }
    const effect = evaluateRules([disableRule], selection)
    const sanitized = sanitizeSelection(selection, effect)
    expect(sanitized[charSize]).toBeUndefined()
  })

  it('does not remove values unaffected by rules', () => {
    const selection: Selection = { [charMaterial]: valOak, [charSize]: valLarge }
    const effect = evaluateRules([disableRule], selection)
    const sanitized = sanitizeSelection(selection, effect)
    expect(sanitized[charSize]).toBe(valLarge)
    expect(sanitized[charMaterial]).toBe(valOak)
  })

  it('initial selection is sanitized — bug 5', () => {
    // If pine is pre-selected for material, large must be removed (hidden by hideRule)
    const initial: Selection = { [charMaterial]: valPine, [charSize]: valLarge }
    const effect = evaluateRules([hideRule], initial)
    const sanitized = sanitizeSelection(initial, effect)
    expect(sanitized[charSize]).toBeUndefined()
  })
})

// ─── calculatePrice ───────────────────────────────────────────────────────────

describe('calculatePrice', () => {
  it('sums base price plus selected modifiers', () => {
    const selection: Selection = { [charMaterial]: valOak, [charSize]: valLarge }
    expect(calculatePrice(500, selection, chars, {})).toBe(650)
  })

  it('applies price override instead of raw modifier', () => {
    const selection: Selection = { [charMaterial]: valOak, [charSize]: valLarge }
    expect(calculatePrice(500, selection, chars, { [charMaterial]: 200 })).toBe(750)
  })

  it('clamps total to zero', () => {
    const selection: Selection = { [charMaterial]: valPine }
    expect(calculatePrice(100, selection, chars, { [charMaterial]: -500 })).toBe(0)
  })

  it('returns base price when nothing selected', () => {
    expect(calculatePrice(800, {}, chars, {})).toBe(800)
  })
})

// ─── inquiry snapshot reconciliation — bug 6 ─────────────────────────────────

describe('inquiry snapshot vs total price', () => {
  it('line item modifier uses price override, not raw value modifier', () => {
    const selection: Selection = { [charMaterial]: valOak, [charSize]: valLarge }
    const effect = evaluateRules([priceOverrideRule], selection)

    const lineItems = chars
      .filter(c => !!selection[c.id])
      .map(c => {
        const v = c.values.find(val => val.id === selection[c.id])
        const effectiveModifier = c.id in effect.priceOverrides
          ? effect.priceOverrides[c.id]
          : (v?.price_modifier ?? 0)
        return { characteristic_name: c.id, value_label: v?.id ?? '', price_modifier: effectiveModifier }
      })

    const materialItem = lineItems.find(l => l.characteristic_name === charMaterial)!
    expect(materialItem.price_modifier).toBe(200) // override, not raw 100

    const total = calculatePrice(500, selection, chars, effect.priceOverrides)
    const lineTotal = lineItems.reduce((sum, l) => sum + l.price_modifier, 500)
    expect(lineTotal).toBe(total) // both 750
  })
})
