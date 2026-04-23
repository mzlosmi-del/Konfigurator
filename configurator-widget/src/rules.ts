import type { ConfigurationRule, Selection, NumericInputs } from './types'

export interface RuleEffect {
  hiddenValues:         Set<string>              // value IDs that should be hidden
  disabledValues:       Set<string>              // value IDs that should be disabled
  priceOverrides:       Record<string, number>   // charId → override modifier
  defaultValues:        Record<string, string>   // charId → valueId (customer may override)
  lockedValues:         Record<string, string>   // charId → valueId (customer cannot override)
  defaultNumericValues: Record<string, number>   // charId → number (customer may override)
  lockedNumericValues:  Record<string, number>   // charId → number (customer cannot override)
}

/**
 * Evaluate all active rules against the current selection and numeric inputs.
 */
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

/**
 * Calculate total price from base + selected modifiers + any overrides.
 */
export function calculatePrice(
  basePrice: number,
  selection: Selection,
  characteristics: Array<{ id: string; values: Array<{ id: string; price_modifier: number }> }>,
  priceOverrides: Record<string, number>
): number {
  let total = basePrice

  for (const char of characteristics) {
    const selectedValueId = selection[char.id]
    if (!selectedValueId) continue

    if (char.id in priceOverrides) {
      total += priceOverrides[char.id]
      continue
    }

    const value = char.values.find(v => v.id === selectedValueId)
    if (value) total += value.price_modifier
  }

  return Math.max(0, total)
}

/**
 * Auto-deselect values that became hidden/disabled after a selection change.
 * Also enforce locked values (override selection if rule demands a specific value).
 */
export function sanitizeSelection(
  selection: Selection,
  effect: RuleEffect
): Selection {
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

/**
 * Apply default values from rules to selection.
 * Only applies defaults that are NEWLY active (not present in prevDefaultValues),
 * so a user's manual override is preserved while the condition stays active.
 * Pass prevDefaultValues={} during initialisation to apply all active defaults.
 */
export function applyDefaultValues(
  selection: Selection,
  effect: RuleEffect,
  skip: Set<string> = new Set(),
  prevDefaultValues: Record<string, string> = {}
): Selection {
  const next = { ...selection }
  for (const [charId, valueId] of Object.entries(effect.defaultValues)) {
    if (!skip.has(charId) && !(charId in prevDefaultValues)) {
      next[charId] = valueId
    }
  }
  return next
}

/**
 * Apply default numeric values from rules to numeric inputs.
 * Only sets a default if the characteristic has no current input.
 */
export function applyNumericDefaults(
  numericInputs: NumericInputs,
  effect: RuleEffect
): NumericInputs {
  const next = { ...numericInputs }
  for (const [charId, value] of Object.entries(effect.defaultNumericValues)) {
    if (!(charId in next)) {
      next[charId] = value
    }
  }
  return next
}
