import { supabase } from './supabase'
import { resolveTextI18n } from './texts'
import type { PricingFormula, FormulaNode, TenantText } from '@/types/database'

export async function fetchFormulas(productId: string): Promise<PricingFormula[]> {
  const { data, error } = await supabase
    .from('pricing_formulas')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const formulas = (data ?? []) as PricingFormula[]

  // Attach translated names from tenant_texts (level='pricing_formula').
  if (formulas.length > 0) {
    const rows = await fetchFormulaNameTexts(formulas.map(f => f.id))
    for (const f of formulas) {
      f.name_i18n = resolveTextI18n(rows, 'pricing_formula', f.id, 'name')
    }
  }
  return formulas
}

/** All `pricing_formula` / slot='name' rows for the given formula ids, both
 *  languages. Shared by the formula editor and the quotation snapshot builder. */
export async function fetchFormulaNameTexts(formulaIds: string[]): Promise<TenantText[]> {
  const ids = Array.from(new Set(formulaIds.filter(Boolean)))
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('tenant_texts')
    .select('*')
    .eq('level', 'pricing_formula')
    .eq('slot', 'name')
    .in('reference_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []) as TenantText[]
}

export async function createFormula(input: {
  product_id: string
  name: string
  formula: FormulaNode
}): Promise<PricingFormula> {
  const { data, error } = await supabase
    .from('pricing_formulas')
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PricingFormula
}

export async function updateFormula(
  id: string,
  input: Partial<Pick<PricingFormula, 'name' | 'is_active' | 'sort_order'> & { formula: FormulaNode }>
): Promise<PricingFormula> {
  const { data, error } = await supabase
    .from('pricing_formulas')
    .update(input as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PricingFormula
}

export async function deleteFormula(id: string): Promise<void> {
  const { error } = await supabase.from('pricing_formulas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
