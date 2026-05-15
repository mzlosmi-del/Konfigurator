// Pure rule-engine functions for use in the admin configurator dialog.
// Ported from configurator-widget/src/rules.ts — keep this in sync.
import type {
  ConfigurationRule, NumExpr, RuleEffect as RuleEffectV2, RulePredicate,
} from '@/types/database'

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

function evalPredicate(p: RulePredicate, selection: Selection, numericInputs: NumericInputs): boolean {
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

function applyEffect(effect: RuleEffectV2, result: RuleEffect, numericInputs: NumericInputs): void {
  switch (effect.type) {
    case 'hide_value':          result.hiddenValues.add(effect.value_id); return
    case 'disable_value':       result.disabledValues.add(effect.value_id); return
    case 'set_value_default':   result.defaultValues[effect.char_id] = effect.value_id; return
    case 'set_value_locked':
      result.lockedValues[effect.char_id] = effect.value_id
      // "Free of charge" — waive the locked value's price contribution.
      if (effect.waive_price) result.priceOverrides[effect.char_id] = 0
      return
    case 'set_numeric_default': result.defaultNumericValues[effect.char_id] = evalNumExpr(effect.expr, numericInputs); return
    case 'set_numeric_locked':  result.lockedNumericValues[effect.char_id]  = evalNumExpr(effect.expr, numericInputs); return
  }
}

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
  skip: Set<string> = new Set(),
  prevDefaultValues: Record<string, string> = {},
): Selection {
  const next = { ...selection }
  for (const [charId, valueId] of Object.entries(effect.defaultValues)) {
    if (!skip.has(charId) && !(charId in prevDefaultValues)) next[charId] = valueId
  }
  return next
}
