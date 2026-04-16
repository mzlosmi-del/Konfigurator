import { supabase } from './supabase'
import type { ConfigurationRule, RuleType } from '@/types/database'

export async function fetchRules(productId: string): Promise<ConfigurationRule[]> {
  const { data, error } = await supabase
    .from('configuration_rules')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ConfigurationRule[]
}

export async function createRule(input: {
  product_id: string
  rule_type: RuleType
  condition: ConfigurationRule['condition']
  effect: ConfigurationRule['effect']
}): Promise<ConfigurationRule> {
  const { data, error } = await supabase
    .from('configuration_rules')
    .insert({ ...input, is_active: true } as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ConfigurationRule
}

export async function updateRule(
  id: string,
  input: Partial<Pick<ConfigurationRule, 'rule_type' | 'condition' | 'effect' | 'is_active'>>
): Promise<ConfigurationRule> {
  const { data, error } = await supabase
    .from('configuration_rules')
    .update(input as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ConfigurationRule
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('configuration_rules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
