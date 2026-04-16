import type { ConfigurationRule, Selection } from './types'

export interface RuleEffect {
  hiddenValues:   Set<string>              // value IDs that should be hidden
  disabledValues: Set<string>              // value IDs that should be disabled
  priceOverrides: Record<string, number>   // charId → override modifier
  defaultValues:  Record<string, string>   // charId → valueId (customer may override)
  lockedValues:   Record<string, string>   // charId → valueId (customer cannot override)
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
    hiddenValues:   new Set(),
    disabledValues: new Set(),
    priceOverrides: {},
    defaultValues:  {},
    lockedValues:   {},
  }

  for (const rule of rules) {
    if (!rule.is_active) continue

    const { characteristic_id, value_id } = rule.condition
    if (selection[characteristic_id] !== value_id) continue

    switch (rule.rule_type) {
      case 'hide_value':
        if (rule.effect.value_id) result.hiddenValues.add(rule.effect.value_id)
        break

      case 'disable_value':
        if (rule.effect.value_id) result.disabledValues.add(rule.effect.value_id)
        break

      case 'price_override':
        if (rule.effect.price_modifier !== undefined) {
          const targetCharId = rule.effect.characteristic_id ?? characteristic_id
          result.priceOverrides[targetCharId] = rule.effect.price_modifier
        }
        break

      case 'set_value_default':
        if (rule.effect.characteristic_id && rule.effect.value_id) {
          result.defaultValues[rule.effect.characteristic_id] = rule.effect.value_id
        }
        break

      case 'set_value_locked':
        if (rule.effect.characteristic_id && rule.effect.value_id) {
          result.lockedValues[rule.effect.characteristic_id] = rule.effect.value_id
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

  // Remove hidden/disabled selections
  for (const [charId, valueId] of Object.entries(next)) {
    if (effect.hiddenValues.has(valueId) || effect.disabledValues.has(valueId)) {
      delete next[charId]
    }
  }

  // Apply locked values (forced, overrides whatever user selected)
  for (const [charId, valueId] of Object.entries(effect.lockedValues)) {
    next[charId] = valueId
  }

  return next
}

/**
 * Apply default values from rules to selection.
 * Only sets a default if the characteristic has no current selection.
 * Does NOT override user selections.
 */
export function applyDefaultValues(
  selection: Selection,
  effect: RuleEffect
): Selection {
  const next = { ...selection }
  for (const [charId, valueId] of Object.entries(effect.defaultValues)) {
    if (!next[charId]) {
      next[charId] = valueId
    }
  }
  return next
}
