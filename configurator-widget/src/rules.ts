import type { ConfigurationRule, Selection } from './types'

export interface RuleEffect {
  hiddenValues: Set<string>   // value IDs that should be hidden
  disabledValues: Set<string> // value IDs that should be disabled
  priceOverrides: Record<string, number> // charId → override modifier
}

/**
 * Evaluate all active rules against the current selection.
 * Rules are single-condition: IF char=value THEN effect.
 */
export function evaluateRules(
  rules: ConfigurationRule[],
  selection: Selection
): RuleEffect {
  const result: RuleEffect = {
    hiddenValues: new Set(),
    disabledValues: new Set(),
    priceOverrides: {},
  }

  for (const rule of rules) {
    const { characteristic_id, value_id } = rule.condition

    // Check if the condition is met
    if (selection[characteristic_id] !== value_id) continue

    if (rule.rule_type === 'hide_value' && rule.effect.value_id) {
      result.hiddenValues.add(rule.effect.value_id)
    }

    if (rule.rule_type === 'disable_value' && rule.effect.value_id) {
      result.disabledValues.add(rule.effect.value_id)
    }

    if (rule.rule_type === 'price_override' && rule.effect.price_modifier !== undefined) {
      const targetCharId = rule.effect.characteristic_id ?? characteristic_id
      result.priceOverrides[targetCharId] = rule.effect.price_modifier
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

    // Check for a price override on this characteristic
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
 * Auto-deselect any values that became hidden/disabled after a selection change.
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
  return next
}
