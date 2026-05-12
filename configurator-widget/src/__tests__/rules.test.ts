import { describe, it, expect } from 'vitest'
import { evaluateRules, calculatePrice, sanitizeSelection } from '../rules'
import type { ConfigurationRule, Selection } from '../types'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const charMaterial = 'char-material'
const charSize     = 'char-size'
const charWidth    = 'char-width'
const charHeight   = 'char-height'
const valOak       = 'val-oak'
const valPine      = 'val-pine'
const valSmall     = 'val-small'
const valLarge     = 'val-large'

const hideRule: ConfigurationRule = {
  id: 'rule-1',
  condition: { mode: 'all', predicates: [
    { type: 'select_eq', char_id: charMaterial, value_id: valPine },
  ]},
  effects: [{ type: 'hide_value', value_id: valLarge }],
  is_active: true,
}

const disableRule: ConfigurationRule = {
  id: 'rule-2',
  condition: { mode: 'all', predicates: [
    { type: 'select_eq', char_id: charMaterial, value_id: valOak },
  ]},
  effects: [{ type: 'disable_value', value_id: valSmall }],
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

  it('does not apply inactive rules', () => {
    const inactive = { ...hideRule, is_active: false }
    const selection: Selection = { [charMaterial]: valPine }
    const effect = evaluateRules([inactive], selection)
    expect(effect.hiddenValues.size).toBe(0)
  })

  it('applies multiple effects from a single rule', () => {
    const rule: ConfigurationRule = {
      id: 'rule-multi',
      condition: { mode: 'all', predicates: [
        { type: 'select_eq', char_id: charMaterial, value_id: valPine },
      ]},
      effects: [
        { type: 'hide_value',    value_id: valLarge },
        { type: 'disable_value', value_id: valSmall },
      ],
      is_active: true,
    }
    const selection: Selection = { [charMaterial]: valPine }
    const effect = evaluateRules([rule], selection)
    expect(effect.hiddenValues.has(valLarge)).toBe(true)
    expect(effect.disabledValues.has(valSmall)).toBe(true)
  })

  it('AND mode requires every predicate to match', () => {
    const rule: ConfigurationRule = {
      id: 'rule-and',
      condition: { mode: 'all', predicates: [
        { type: 'select_eq', char_id: charMaterial, value_id: valPine },
        { type: 'select_eq', char_id: charSize,     value_id: valLarge },
      ]},
      effects: [{ type: 'hide_value', value_id: valSmall }],
      is_active: true,
    }
    // Only one predicate true ⇒ rule does NOT fire
    expect(evaluateRules([rule], { [charMaterial]: valPine }).hiddenValues.has(valSmall)).toBe(false)
    // Both predicates true ⇒ fires
    expect(evaluateRules([rule], { [charMaterial]: valPine, [charSize]: valLarge }).hiddenValues.has(valSmall)).toBe(true)
  })

  it('OR mode fires when any predicate matches', () => {
    const rule: ConfigurationRule = {
      id: 'rule-or',
      condition: { mode: 'any', predicates: [
        { type: 'select_eq', char_id: charMaterial, value_id: valPine },
        { type: 'select_eq', char_id: charMaterial, value_id: valOak  },
      ]},
      effects: [{ type: 'hide_value', value_id: valLarge }],
      is_active: true,
    }
    expect(evaluateRules([rule], { [charMaterial]: valPine }).hiddenValues.has(valLarge)).toBe(true)
    expect(evaluateRules([rule], { [charMaterial]: valOak  }).hiddenValues.has(valLarge)).toBe(true)
    expect(evaluateRules([rule], { [charMaterial]: 'val-other' }).hiddenValues.has(valLarge)).toBe(false)
  })

  it('evaluates arithmetic in a numeric comparison', () => {
    // IF Width * Height >= 5 → lock Reinforcement (numeric) to Width * 1.2
    const rule: ConfigurationRule = {
      id: 'rule-arith',
      condition: { mode: 'all', predicates: [{
        type: 'cmp', op: 'gte',
        left:  { type: 'arith', op: 'multiply',
                 left:  { type: 'input', char_id: charWidth },
                 right: { type: 'input', char_id: charHeight } },
        right: { type: 'number', value: 5 },
      }]},
      effects: [{
        type: 'set_numeric_locked',
        char_id: 'char-reinforcement',
        expr: { type: 'arith', op: 'multiply',
                left:  { type: 'input',  char_id: charWidth },
                right: { type: 'number', value: 1.2 } },
      }],
      is_active: true,
    }
    // 2 × 2 < 5 → no effect
    expect(evaluateRules([rule], {}, { [charWidth]: 2, [charHeight]: 2 })
      .lockedNumericValues['char-reinforcement']).toBeUndefined()
    // 3 × 2 = 6 ≥ 5 → reinforcement = 3 × 1.2 = 3.6
    expect(evaluateRules([rule], {}, { [charWidth]: 3, [charHeight]: 2 })
      .lockedNumericValues['char-reinforcement']).toBeCloseTo(3.6)
  })

  it('select_neq fires when the selected value differs', () => {
    const rule: ConfigurationRule = {
      id: 'rule-neq',
      condition: { mode: 'all', predicates: [
        { type: 'select_neq', char_id: charMaterial, value_id: valOak },
      ]},
      effects: [{ type: 'hide_value', value_id: valLarge }],
      is_active: true,
    }
    expect(evaluateRules([rule], { [charMaterial]: valPine }).hiddenValues.has(valLarge)).toBe(true)
    expect(evaluateRules([rule], { [charMaterial]: valOak  }).hiddenValues.has(valLarge)).toBe(false)
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

  it('initial selection is sanitized', () => {
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

  it('clamps total to zero', () => {
    const selection: Selection = { [charMaterial]: valPine }
    expect(calculatePrice(100, selection, chars, { [charMaterial]: -500 })).toBe(0)
  })

  it('returns base price when nothing selected', () => {
    expect(calculatePrice(800, {}, chars, {})).toBe(800)
  })
})
