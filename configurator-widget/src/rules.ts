import type {
  ConfigurationRule, NumExpr, RulePredicate, RuleEffect as RuleEffectV2,
  Selection, NumericInputs,
} from './types'

export interface RuleEffect {
  hiddenValues:         Set<string>              // value IDs that should be hidden
  disabledValues:       Set<string>              // value IDs that should be disabled
  priceOverrides:       Record<string, number>   // charId → override modifier
  defaultValues:        Record<string, string>   // charId → valueId (customer may override)
  lockedValues:         Record<string, string>   // charId → valueId (customer cannot override)
  defaultNumericValues: Record<string, number>   // charId → number (customer may override)
  lockedNumericValues:  Record<string, number>   // charId → number (customer cannot override)
}

function evalNumExpr(expr: NumExpr, numericInputs: NumericInputs): number {
  switch (expr.type) {
    case 'number': return expr.value
    case 'input':  return numericInputs[expr.char_id] ?? 0
    case 'arith': {
      const a = evalNumExpr(expr.left,  numericInputs)
      const b = evalNumExpr(expr.right, numericInputs)
      switch (expr.op) {
        case 'add':      return a + b
        case 'subtract': return a - b
        case 'multiply': return a * b
        case 'divide':   return b === 0 ? 0 : a / b
      }
    }
  }
}

function evalPredicate(
  p:             RulePredicate,
  selection:     Selection,
  numericInputs: NumericInputs,
): boolean {
  switch (p.type) {
    case 'select_eq':  return selection[p.char_id] === p.value_id
    case 'select_neq': return selection[p.char_id] !== p.value_id
    case 'cmp': {
      const left  = evalNumExpr(p.left,  numericInputs)
      const right = evalNumExpr(p.right, numericInputs)
      switch (p.op) {
        case 'gt':  return left >  right
        case 'gte': return left >= right
        case 'lt':  return left <  right
        case 'lte': return left <= right
        case 'eq':  return left === right
        case 'neq': return left !== right
      }
    }
  }
}

function applyEffect(
  effect:        RuleEffectV2,
  result:        RuleEffect,
  numericInputs: NumericInputs,
): void {
  switch (effect.type) {
    case 'hide_value':
      result.hiddenValues.add(effect.value_id)
      return
    case 'disable_value':
      result.disabledValues.add(effect.value_id)
      return
    case 'set_value_default':
      result.defaultValues[effect.char_id] = effect.value_id
      return
    case 'set_value_locked':
      result.lockedValues[effect.char_id] = effect.value_id
      return
    case 'set_numeric_default':
      result.defaultNumericValues[effect.char_id] = evalNumExpr(effect.expr, numericInputs)
      return
    case 'set_numeric_locked':
      result.lockedNumericValues[effect.char_id] = evalNumExpr(effect.expr, numericInputs)
      return
  }
}

/**
 * Evaluate all active rules against the current selection and numeric inputs.
 *
 * Each rule has a flat predicate list combined via `mode` ('all' = AND,
 * 'any' = OR). An empty predicate list under `all` is a vacuous true; under
 * `any` it's false. Effects are applied in array order so a later effect
 * with the same target deterministically wins.
 */
export function evaluateRules(
  rules:         ConfigurationRule[],
  selection:     Selection,
  numericInputs: NumericInputs = {},
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
    const preds = rule.condition?.predicates ?? []
    const mode  = rule.condition?.mode ?? 'all'

    const conditionMet = mode === 'all'
      ? preds.every(p => evalPredicate(p, selection, numericInputs))
      : preds.some( p => evalPredicate(p, selection, numericInputs))
    if (!conditionMet) continue

    for (const effect of rule.effects ?? []) {
      applyEffect(effect, result, numericInputs)
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
 * Per-option breakdown of the modifier contributions used in calculatePrice.
 * Returns one entry per selected characteristic that contributed a non-zero modifier.
 */
export interface OptionBreakdown {
  char_id:    string
  value_id:   string | null   // null when contribution comes from a rule price override
  amount:     number
  overridden: boolean
}

export function buildOptionBreakdown(
  selection: Selection,
  characteristics: Array<{ id: string; values: Array<{ id: string; price_modifier: number }> }>,
  priceOverrides: Record<string, number>
): OptionBreakdown[] {
  const out: OptionBreakdown[] = []
  for (const char of characteristics) {
    const selectedValueId = selection[char.id]
    if (!selectedValueId) continue
    if (char.id in priceOverrides) {
      out.push({ char_id: char.id, value_id: selectedValueId, amount: priceOverrides[char.id], overridden: true })
      continue
    }
    const value = char.values.find(v => v.id === selectedValueId)
    if (value) out.push({ char_id: char.id, value_id: value.id, amount: value.price_modifier, overridden: false })
  }
  return out
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
