import { supabase } from './supabase'
import type { PricingFormula, FormulaNode } from '@/types/database'

export async function fetchFormulas(productId: string): Promise<PricingFormula[]> {
  const { data, error } = await supabase
    .from('pricing_formulas')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PricingFormula[]
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
    .update(input as any)
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
