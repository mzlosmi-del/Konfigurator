import type { FormulaNode, Characteristic, Selection, NumericInputs } from './types'

export interface FormulaContext {
  base_price: number
  selection: Selection
  numericInputs: NumericInputs
  characteristics: Characteristic[]
  formulaResults?: Record<string, number>
}

/**
 * Recursively evaluate a FormulaNode.
 * Returns a number for arithmetic/leaf nodes and a boolean for logical/comparison nodes.
 * The top-level node of a pricing formula must resolve to a number (surcharge or discount).
 */
export function evaluateFormula(node: FormulaNode, ctx: FormulaContext): number | boolean {
  switch (node.type) {
    case 'number':
      return node.value

    case 'base_price':
      return ctx.base_price

    case 'modifier': {
      const char = ctx.characteristics.find(c => c.id === node.char_id)
      if (!char) return 0
      const selectedId = ctx.selection[node.char_id]
      const val = char.values.find(v => v.id === selectedId)
      return val?.price_modifier ?? 0
    }

    case 'input':
      return ctx.numericInputs[node.char_id] ?? 0

    case 'is_selected':
      return ctx.selection[node.char_id] === node.value_id

    case 'formula_result':
      return ctx.formulaResults?.[node.formula_id] ?? 0

    case 'add':
      return (evaluateFormula(node.left, ctx) as number) + (evaluateFormula(node.right, ctx) as number)

    case 'subtract':
      return (evaluateFormula(node.left, ctx) as number) - (evaluateFormula(node.right, ctx) as number)

    case 'multiply':
      return (evaluateFormula(node.left, ctx) as number) * (evaluateFormula(node.right, ctx) as number)

    case 'divide': {
      const divisor = evaluateFormula(node.right, ctx) as number
      if (divisor === 0) return 0
      return (evaluateFormula(node.left, ctx) as number) / divisor
    }

    case 'gt':
      return (evaluateFormula(node.left, ctx) as number) > (evaluateFormula(node.right, ctx) as number)

    case 'gte':
      return (evaluateFormula(node.left, ctx) as number) >= (evaluateFormula(node.right, ctx) as number)

    case 'lt':
      return (evaluateFormula(node.left, ctx) as number) < (evaluateFormula(node.right, ctx) as number)

    case 'lte':
      return (evaluateFormula(node.left, ctx) as number) <= (evaluateFormula(node.right, ctx) as number)

    case 'eq':
      return (evaluateFormula(node.left, ctx) as number) === (evaluateFormula(node.right, ctx) as number)

    case 'and':
      return !!(evaluateFormula(node.left, ctx)) && !!(evaluateFormula(node.right, ctx))

    case 'or':
      return !!(evaluateFormula(node.left, ctx)) || !!(evaluateFormula(node.right, ctx))

    case 'if': {
      const cond = evaluateFormula(node.condition, ctx)
      return cond ? evaluateFormula(node.then, ctx) : evaluateFormula(node.else_node, ctx)
    }

    default:
      return 0
  }
}

/**
 * Sum all active formula results for a given context.
 * Each formula contributes a surcharge (positive) or discount (negative).
 */
export function calculateFormulaTotal(
  formulas: Array<{ id: string; formula: FormulaNode; is_active: boolean }>,
  ctx: FormulaContext
): number {
  let total = 0
  const formulaResults: Record<string, number> = { ...ctx.formulaResults }
  for (const f of formulas) {
    if (!f.is_active) continue
    try {
      const result = evaluateFormula(f.formula, { ...ctx, formulaResults }) as number
      formulaResults[f.id] = result
      total += result
    } catch {
      // Malformed formula — skip silently
    }
  }
  return total
}

/**
 * Per-formula breakdown of contributions. Useful for UI displays that want to
 * show the user how each named formula adds to (or subtracts from) the total.
 */
export interface FormulaBreakdownEntry {
  id:     string
  name:   string
  amount: number
}

export function calculateFormulaBreakdown(
  formulas: Array<{ id: string; name: string; formula: FormulaNode; is_active: boolean }>,
  ctx: FormulaContext
): FormulaBreakdownEntry[] {
  const out: FormulaBreakdownEntry[] = []
  const formulaResults: Record<string, number> = { ...ctx.formulaResults }
  for (const f of formulas) {
    if (!f.is_active) continue
    try {
      const result = evaluateFormula(f.formula, { ...ctx, formulaResults }) as number
      formulaResults[f.id] = result
      out.push({ id: f.id, name: f.name, amount: result })
    } catch {
      // Malformed formula — skip silently
    }
  }
  return out
}
