import { supabase } from './supabase'
import type { Database } from '@/types/database'

export type ProductPriceSchedule   = Database['public']['Tables']['product_price_schedules']['Row']
export type CharModifierSchedule   = Database['public']['Tables']['characteristic_modifier_schedules']['Row']
export type ProductTaxPreset       = Database['public']['Tables']['product_tax_presets']['Row']
export type ProductAdjustmentPreset = Database['public']['Tables']['product_adjustment_presets']['Row']

export type ProductPriceScheduleInsert   = Database['public']['Tables']['product_price_schedules']['Insert']
export type CharModifierScheduleInsert   = Database['public']['Tables']['characteristic_modifier_schedules']['Insert']
export type ProductTaxPresetInsert       = Database['public']['Tables']['product_tax_presets']['Insert']
export type ProductAdjustmentPresetInsert = Database['public']['Tables']['product_adjustment_presets']['Insert']

// Active pricing snapshot used by QuotationFormPage
export interface ActivePricing {
  scheduledPrice:     number | null
  taxPresets:         { label: string; rate: number }[]
  adjustmentPresets:  { id: string; label: string; adjustment_type: 'surcharge' | 'discount'; mode: 'percent' | 'fixed'; value: number }[]
}

// ── Product price schedules ───────────────────────────────────────────────────

export async function fetchPriceSchedules(productId: string): Promise<ProductPriceSchedule[]> {
  const { data, error } = await supabase
    .from('product_price_schedules')
    .select('*')
    .eq('product_id', productId)
    .order('valid_from', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertPriceSchedule(
  row: ProductPriceScheduleInsert & { id?: string }
): Promise<ProductPriceSchedule> {
  const { data, error } = await supabase
    .from('product_price_schedules')
    .upsert(row as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ProductPriceSchedule
}

export async function deletePriceSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('product_price_schedules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Characteristic modifier schedules ────────────────────────────────────────

export async function fetchModifierSchedules(characteristicValueId: string): Promise<CharModifierSchedule[]> {
  const { data, error } = await supabase
    .from('characteristic_modifier_schedules')
    .select('*')
    .eq('characteristic_value_id', characteristicValueId)
    .order('valid_from', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchAllModifierSchedules(): Promise<CharModifierSchedule[]> {
  const { data, error } = await supabase
    .from('characteristic_modifier_schedules')
    .select('*')
    .order('valid_from', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertModifierSchedule(
  row: CharModifierScheduleInsert & { id?: string }
): Promise<CharModifierSchedule> {
  const { data, error } = await supabase
    .from('characteristic_modifier_schedules')
    .upsert(row as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CharModifierSchedule
}

export async function deleteModifierSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('characteristic_modifier_schedules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Tax presets ───────────────────────────────────────────────────────────────

export async function fetchTaxPresets(productId: string): Promise<ProductTaxPreset[]> {
  const { data, error } = await supabase
    .from('product_tax_presets')
    .select('*')
    .eq('product_id', productId)
    .order('valid_from', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertTaxPreset(
  row: ProductTaxPresetInsert & { id?: string }
): Promise<ProductTaxPreset> {
  const { data, error } = await supabase
    .from('product_tax_presets')
    .upsert(row as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ProductTaxPreset
}

export async function deleteTaxPreset(id: string): Promise<void> {
  const { error } = await supabase.from('product_tax_presets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Adjustment presets ────────────────────────────────────────────────────────

export async function fetchAdjustmentPresets(productId: string): Promise<ProductAdjustmentPreset[]> {
  const { data, error } = await supabase
    .from('product_adjustment_presets')
    .select('*')
    .eq('product_id', productId)
    .order('valid_from', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertAdjustmentPreset(
  row: ProductAdjustmentPresetInsert & { id?: string }
): Promise<ProductAdjustmentPreset> {
  const { data, error } = await supabase
    .from('product_adjustment_presets')
    .upsert(row as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ProductAdjustmentPreset
}

export async function deleteAdjustmentPreset(id: string): Promise<void> {
  const { error } = await supabase.from('product_adjustment_presets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Active pricing snapshot ───────────────────────────────────────────────────

export async function fetchActivePricing(productId: string, today: string): Promise<ActivePricing> {
  const [schedules, taxPresets, adjustmentPresets] = await Promise.all([
    supabase
      .from('product_price_schedules')
      .select('price, valid_from, valid_to')
      .eq('product_id', productId)
      .lte('valid_from', today)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .order('valid_from', { ascending: false })
      .limit(1),
    supabase
      .from('product_tax_presets')
      .select('label, rate')
      .eq('product_id', productId)
      .lte('valid_from', today)
      .or(`valid_to.is.null,valid_to.gte.${today}`),
    supabase
      .from('product_adjustment_presets')
      .select('id, label, adjustment_type, mode, value')
      .eq('product_id', productId)
      .lte('valid_from', today)
      .or(`valid_to.is.null,valid_to.gte.${today}`),
  ])

  if (schedules.error) throw new Error(schedules.error.message)
  if (taxPresets.error) throw new Error(taxPresets.error.message)
  if (adjustmentPresets.error) throw new Error(adjustmentPresets.error.message)

  const schedData = schedules.data as { price: number }[] | null
  const taxData   = taxPresets.data as { label: string; rate: number }[] | null
  const adjData   = adjustmentPresets.data as {
    id: string; label: string; adjustment_type: string; mode: string; value: number
  }[] | null

  return {
    scheduledPrice: schedData?.[0]?.price !== undefined ? Number(schedData[0].price) : null,
    taxPresets: (taxData ?? []).map(t => ({ label: t.label, rate: Number(t.rate) })),
    adjustmentPresets: (adjData ?? []).map(a => ({
      id:              a.id,
      label:           a.label,
      adjustment_type: a.adjustment_type as 'surcharge' | 'discount',
      mode:            a.mode as 'percent' | 'fixed',
      value:           Number(a.value),
    })),
  }
}
