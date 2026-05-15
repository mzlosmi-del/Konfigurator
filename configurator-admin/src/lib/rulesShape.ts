// Helpers for the configuration-rules v2 shape (see migrations/074_rules_v2.sql).
// Used by RulesPanel for default values, summary rendering and basic
// validation before save.

import type {
  Characteristic, CharacteristicValue,
  ConfigurationRule, NumExpr, RuleArithOp, RuleComparator,
  RuleCondition, RuleEffect, RuleEffectKind, RulePredicate,
} from '@/types/database'

export const COMPARATOR_LABELS: Record<RuleComparator, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠',
}
export const ARITH_LABELS: Record<RuleArithOp, string> = {
  add: '+', subtract: '−', multiply: '×', divide: '÷',
}

export const EFFECT_KINDS: { kind: RuleEffectKind; label: string; needsValueTarget: boolean; needsNumericTarget: boolean }[] = [
  { kind: 'hide_value',         label: 'Hide value',          needsValueTarget: true,  needsNumericTarget: false },
  { kind: 'disable_value',      label: 'Disable value',       needsValueTarget: true,  needsNumericTarget: false },
  { kind: 'set_value_default',  label: 'Set default (value)', needsValueTarget: true,  needsNumericTarget: false },
  { kind: 'set_value_locked',   label: 'Lock value',          needsValueTarget: true,  needsNumericTarget: false },
  { kind: 'set_numeric_default', label: 'Set default (number)', needsValueTarget: false, needsNumericTarget: true },
  { kind: 'set_numeric_locked',  label: 'Lock number',          needsValueTarget: false, needsNumericTarget: true },
]

export function literalExpr(value = 0): NumExpr {
  return { type: 'number', value }
}

export function emptyCondition(): RuleCondition {
  return { mode: 'all', predicates: [] }
}

export function emptySelectPredicate(charId = '', valueId = ''): RulePredicate {
  return { type: 'select_eq', char_id: charId, value_id: valueId }
}

export function emptyCmpPredicate(): RulePredicate {
  return {
    type: 'cmp', op: 'gte',
    left:  literalExpr(),
    right: literalExpr(),
  }
}

export function emptyEffect(kind: RuleEffectKind = 'hide_value'): RuleEffect {
  switch (kind) {
    case 'hide_value':          return { type: 'hide_value',          value_id: '' }
    case 'disable_value':       return { type: 'disable_value',       value_id: '' }
    case 'set_value_default':   return { type: 'set_value_default',   char_id: '', value_id: '' }
    case 'set_value_locked':    return { type: 'set_value_locked',    char_id: '', value_id: '', waive_price: false }
    case 'set_numeric_default': return { type: 'set_numeric_default', char_id: '', expr: literalExpr() }
    case 'set_numeric_locked':  return { type: 'set_numeric_locked',  char_id: '', expr: literalExpr() }
  }
}

// ── Validation ────────────────────────────────────────────────────────────

/** Returns the first validation error string, or null if the rule is OK to save. */
export function validateRule(
  condition: RuleCondition,
  effects:   RuleEffect[],
): string | null {
  if (effects.length === 0)              return 'Add at least one effect'
  if (condition.predicates.length === 0) return 'Add at least one condition'

  for (const p of condition.predicates) {
    if (p.type === 'select_eq' || p.type === 'select_neq') {
      if (!p.char_id || !p.value_id) return 'Pick a characteristic and value for every condition'
    } else if (p.type === 'cmp') {
      if (!hasInputs(p.left) && !hasInputs(p.right)) {
        return 'A numeric condition needs at least one characteristic input'
      }
    }
  }

  for (const e of effects) {
    switch (e.type) {
      case 'hide_value':
      case 'disable_value':
        if (!e.value_id) return 'Pick a value to hide or disable'
        break
      case 'set_value_default':
      case 'set_value_locked':
        if (!e.char_id || !e.value_id) return 'Pick a target characteristic and value'
        break
      case 'set_numeric_default':
      case 'set_numeric_locked':
        if (!e.char_id) return 'Pick a target numeric characteristic'
        break
    }
  }
  return null
}

/** Recursive — true if the expression references at least one input(char_id). */
export function hasInputs(expr: NumExpr): boolean {
  if (expr.type === 'input') return true
  if (expr.type === 'arith') return hasInputs(expr.left) || hasInputs(expr.right)
  return false
}

// ── Summary rendering for the rule list view ──────────────────────────────

export function describeNumExpr(
  expr:  NumExpr,
  chars: Characteristic[],
  lang:  string,
): string {
  if (expr.type === 'number') return String(expr.value)
  if (expr.type === 'input') {
    const c = chars.find(c => c.id === expr.char_id)
    return c ? pickName(c, lang) : '?'
  }
  return `(${describeNumExpr(expr.left, chars, lang)} ${ARITH_LABELS[expr.op]} ${describeNumExpr(expr.right, chars, lang)})`
}

export function describePredicate(
  p:         RulePredicate,
  chars:     Characteristic[],
  valuesMap: Record<string, CharacteristicValue[]>,
  lang:      string,
): string {
  if (p.type === 'select_eq' || p.type === 'select_neq') {
    const op = p.type === 'select_eq' ? '=' : '≠'
    return `${charName(chars, p.char_id, lang)} ${op} ${valueName(valuesMap, p.char_id, p.value_id, lang)}`
  }
  return `${describeNumExpr(p.left, chars, lang)} ${COMPARATOR_LABELS[p.op]} ${describeNumExpr(p.right, chars, lang)}`
}

export function describeEffect(
  e:         RuleEffect,
  chars:     Characteristic[],
  valuesMap: Record<string, CharacteristicValue[]>,
  lang:      string,
): string {
  switch (e.type) {
    case 'hide_value':
      return `hide ${anyValueName(valuesMap, e.value_id, lang)}`
    case 'disable_value':
      return `disable ${anyValueName(valuesMap, e.value_id, lang)}`
    case 'set_value_default':
      return `default ${charName(chars, e.char_id, lang)} = ${valueName(valuesMap, e.char_id, e.value_id, lang)}`
    case 'set_value_locked':
      return `lock ${charName(chars, e.char_id, lang)} = ${valueName(valuesMap, e.char_id, e.value_id, lang)}${e.waive_price ? ' (included)' : ''}`
    case 'set_numeric_default':
      return `default ${charName(chars, e.char_id, lang)} = ${describeNumExpr(e.expr, chars, lang)}`
    case 'set_numeric_locked':
      return `lock ${charName(chars, e.char_id, lang)} = ${describeNumExpr(e.expr, chars, lang)}`
  }
}

export function describeRule(
  rule:      ConfigurationRule,
  chars:     Characteristic[],
  valuesMap: Record<string, CharacteristicValue[]>,
  lang:      string,
): string {
  const joiner = rule.condition.mode === 'all' ? ' AND ' : ' OR '
  const cond = rule.condition.predicates
    .map(p => describePredicate(p, chars, valuesMap, lang))
    .join(joiner) || '(no conditions)'
  const eff = rule.effects.map(e => describeEffect(e, chars, valuesMap, lang)).join(', ') || '(no effects)'
  return `IF ${cond} → ${eff}`
}

// ── Tiny helpers (kept local to avoid a circular dep on i18n) ─────────────

function pickName(c: Characteristic, lang: string): string {
  const i18n = (c.name_i18n as Record<string, string> | null) ?? {}
  return i18n[lang] || c.name
}

function pickValueLabel(v: CharacteristicValue, lang: string): string {
  const i18n = (v.label_i18n as Record<string, string> | null) ?? {}
  return i18n[lang] || v.label
}

function charName(chars: Characteristic[], id: string, lang: string): string {
  const c = chars.find(c => c.id === id)
  return c ? pickName(c, lang) : id ? '?' : ''
}

function valueName(
  valuesMap: Record<string, CharacteristicValue[]>,
  charId:    string,
  valueId:   string,
  lang:      string,
): string {
  const v = valuesMap[charId]?.find(v => v.id === valueId)
  return v ? pickValueLabel(v, lang) : valueId ? '?' : ''
}

function anyValueName(
  valuesMap: Record<string, CharacteristicValue[]>,
  valueId:   string,
  lang:      string,
): string {
  for (const list of Object.values(valuesMap)) {
    const v = list.find(v => v.id === valueId)
    if (v) return pickValueLabel(v, lang)
  }
  return valueId ? '?' : ''
}
