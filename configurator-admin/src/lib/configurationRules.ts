// Pure rule-engine functions for use in the admin configurator dialog.
// Ported from configurator-widget/src/rules.ts — same logic, admin types.
import type { ConfigurationRule } from '@/types/database'

export type Selection     = Record<string, string>
export type NumericInputs = Record<string, number>

export interface RuleEffect {
  hiddenValues:         Set<string>
  disabledValues:       Set<string>
  priceOverrides:       Record<string, number>
  defaultValues:        Record<string, string>
  lockedValues:         Record<string, string>
  defaultNumericValues: Record<string, number>
  lockedNumericValues:  Record<string, number>
}

export function evaluateRules(
  rules: ConfigurationRule[],
  selection: Selection,
  numericInputs: NumericInputs = {}
): RuleEffect {
  const result: RuleEffect = {
    hiddenValues:         new Set(),
    disabledValues:       new Set(),
    priceOverrides:       {},
    defaultValues:        {},
    lockedValues:         {},
    defaultNumericValues: {},
    lockedNumericValues:  {},
  }

  for (const rule of rules) {
    if (!rule.is_active) continue

    const { characteristic_id, value_id, numeric_op, numeric_value } = rule.condition

    let conditionMet = false
    if (numeric_op !== undefined && numeric_value !== undefined) {
      const inputVal = numericInputs[characteristic_id] ?? 0
      switch (numeric_op) {
        case 'gt':  conditionMet = inputVal >  numeric_value; break
        case 'gte': conditionMet = inputVal >= numeric_value; break
        case 'lt':  conditionMet = inputVal <  numeric_value; break
        case 'lte': conditionMet = inputVal <= numeric_value; break
        case 'eq':  conditionMet = inputVal === numeric_value; break
      }
    } else if (value_id !== undefined) {
      conditionMet = selection[characteristic_id] === value_id
    }

    if (!conditionMet) continue

    switch (rule.rule_type) {
      case 'hide_value':
        if (rule.effect.value_id) result.hiddenValues.add(rule.effect.value_id)
        break
      case 'disable_value':
        if (rule.effect.value_id) result.disabledValues.add(rule.effect.value_id)
        break
      case 'set_value_default':
        if (rule.effect.characteristic_id) {
          if (rule.effect.value_id) {
            result.defaultValues[rule.effect.characteristic_id] = rule.effect.value_id
          } else if (rule.effect.numeric_value !== undefined) {
            result.defaultNumericValues[rule.effect.characteristic_id] = rule.effect.numeric_value
          }
        }
        break
      case 'set_value_locked':
        if (rule.effect.characteristic_id) {
          if (rule.effect.value_id) {
            result.lockedValues[rule.effect.characteristic_id] = rule.effect.value_id
          } else if (rule.effect.numeric_value !== undefined) {
            result.lockedNumericValues[rule.effect.characteristic_id] = rule.effect.numeric_value
          }
        }
        break
    }
  }

  return result
}

export function sanitizeSelection(selection: Selection, effect: RuleEffect): Selection {
  const next = { ...selection }
  for (const [charId, valueId] of Object.entries(next)) {
    if (effect.hiddenValues.has(valueId) || effect.disabledValues.has(valueId)) {
      delete next[charId]
    }
  }
  for (const [charId, valueId] of Object.entries(effect.lockedValues)) {
    next[charId] = valueId
  }
  return next
}

export function applyDefaultValues(
  selection: Selection,
  effect: RuleEffect,
  skip: Set<string> = new Set()
): Selection {
  const next = { ...selection }
  for (const [charId, valueId] of Object.entries(effect.defaultValues)) {
    if (!skip.has(charId)) next[charId] = valueId
  }
  return next
}
