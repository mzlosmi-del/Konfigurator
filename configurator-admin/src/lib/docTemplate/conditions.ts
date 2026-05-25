// Evaluator for the show/hide predicate AST (see types.ts `Condition`).
//
// Mirrors the safe, recursive style of formulaEngine.ts but is its own model.
// Leaves reference binding paths resolved through resolvePath.ts. Missing /
// empty operands and unknown operators resolve to a safe `false`.

import type { Condition, CompareOp } from './types'
import type { TemplateContext } from './context'
import { resolveRaw, type ScopeStack } from './resolvePath'

export function evaluateCondition(
  cond: Condition | undefined,
  ctx: TemplateContext,
  scope: ScopeStack,
): boolean {
  // No condition ⇒ always visible.
  if (!cond) return true

  switch (cond.type) {
    case 'and':
      // Empty AND is vacuously true (matches "no constraints").
      return cond.clauses.every(c => evaluateCondition(c, ctx, scope))
    case 'or':
      // Empty OR is false (no clause can satisfy it).
      return cond.clauses.length > 0 && cond.clauses.some(c => evaluateCondition(c, ctx, scope))
    case 'cmp':
      return evaluateCmp(cond.op, resolveRaw(ctx, scope, cond.field), cond.value)
    default:
      return false
  }
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

function evaluateCmp(op: CompareOp, left: unknown, right: string | number | undefined): boolean {
  switch (op) {
    case 'is-empty':  return isEmpty(left)
    case 'not-empty': return !isEmpty(left)
    case 'eq':  return looseEq(left, right)
    case 'neq': return !looseEq(left, right)
    case 'gt':  return numCmp(left, right, (a, b) => a >  b)
    case 'gte': return numCmp(left, right, (a, b) => a >= b)
    case 'lt':  return numCmp(left, right, (a, b) => a <  b)
    case 'lte': return numCmp(left, right, (a, b) => a <= b)
    default:    return false
  }
}

/** Equality that compares numbers numerically and everything else as strings,
 *  so `eq 0` and `eq "0"` behave intuitively for tenant-authored values. */
function looseEq(left: unknown, right: string | number | undefined): boolean {
  if (right === undefined) return isEmpty(left)
  if (typeof right === 'number' || typeof left === 'number') {
    const ln = Number(left), rn = Number(right)
    if (Number.isFinite(ln) && Number.isFinite(rn)) return ln === rn
  }
  return String(left ?? '') === String(right)
}

/** Numeric comparison; non-numeric operands ⇒ false. */
function numCmp(left: unknown, right: string | number | undefined, fn: (a: number, b: number) => boolean): boolean {
  const a = Number(left), b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return fn(a, b)
}
