import { createClient } from '@supabase/supabase-js'
import type {
  FullProductConfig,
  ProductData,
  Characteristic,
  CharacteristicValue,
  VisualizationAsset,
  ConfigurationRule,
  PricingFormula,
  InquiryPayload,
  WidgetConfig,
} from './types'

export function createSupabaseClient(config: WidgetConfig) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function loadProductConfig(config: WidgetConfig): Promise<FullProductConfig> {
  const sb = createSupabaseClient(config)

  // 1. Product
  const { data: product, error: productError } = await sb
    .from('products')
    .select('id, name, description, base_price, currency')
    .eq('id', config.productId)
    .eq('status', 'published')
    .single()

  if (productError || !product) {
    throw new Error('Product not found or not published')
  }

  // 2. Attached characteristics (ordered)
  const { data: attachments, error: attachError } = await sb
    .from('product_characteristics')
    .select('characteristic_id, sort_order, is_required')
    .eq('product_id', config.productId)
    .order('sort_order', { ascending: true })

  if (attachError) throw new Error('Failed to load characteristics')

  const characteristicIds = (attachments ?? []).map((a: { characteristic_id: string }) => a.characteristic_id)

  // Load assets and rules in parallel with characteristic data.
  // Do NOT return early when characteristicIds is empty — a product may have
  // a default visualization asset with no configurable characteristics.
  const [charResult, valuesResult, assetsResult, rulesResult, formulasResult] = await Promise.all([
    characteristicIds.length > 0
      ? sb.from('characteristics').select('id, name, display_type, sort_order').in('id', characteristicIds)
      : Promise.resolve({ data: [], error: null }),
    characteristicIds.length > 0
      ? sb.from('characteristic_values')
          .select('id, characteristic_id, label, price_modifier, sort_order')
          .in('characteristic_id', characteristicIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    sb.from('visualization_assets')
      .select('id, characteristic_value_id, asset_type, url, is_default, sort_order')
      .eq('product_id', config.productId)
      .order('sort_order', { ascending: true }),
    sb.from('configuration_rules')
      .select('id, rule_type, condition, effect, is_active')
      .eq('product_id', config.productId)
      .eq('is_active', true),
    sb.from('pricing_formulas')
      .select('id, name, formula, is_active, sort_order')
      .eq('product_id', config.productId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  if (charResult.error) throw new Error('Failed to load characteristic details')
  if (valuesResult.error) throw new Error('Failed to load characteristic values')
  if (assetsResult.error) throw new Error('Failed to load visualization assets')
  if (rulesResult.error) throw new Error('Failed to load rules')
  if (formulasResult.error) throw new Error('Failed to load pricing formulas')

  const charData     = charResult.data
  const valuesData   = valuesResult.data
  const assetsData   = assetsResult.data
  const rulesData    = rulesResult.data
  const formulasData = formulasResult.data

  // Assemble characteristics with their values, in product attachment order
  const valuesByCharId: Record<string, CharacteristicValue[]> = {}
  for (const v of (valuesData ?? []) as (CharacteristicValue & { characteristic_id: string })[]) {
    if (!valuesByCharId[v.characteristic_id]) valuesByCharId[v.characteristic_id] = []
    valuesByCharId[v.characteristic_id].push(v)
  }

  // Sort characteristics by their attachment order
  const attachmentOrder: Record<string, number> = {}
  for (const a of attachments ?? []) {
    attachmentOrder[(a as { characteristic_id: string; sort_order: number }).characteristic_id] =
      (a as { characteristic_id: string; sort_order: number }).sort_order
  }

  const characteristics: Characteristic[] = ((charData ?? []) as Characteristic[])
    .sort((a, b) => (attachmentOrder[a.id] ?? 0) - (attachmentOrder[b.id] ?? 0))
    .map(c => ({
      ...c,
      values: valuesByCharId[c.id] ?? [],
    }))

  return {
    product: product as ProductData,
    characteristics,
    assets:    (assetsData    ?? []) as VisualizationAsset[],
    rules:     (rulesData     ?? []) as ConfigurationRule[],
    formulas:  (formulasData  ?? []) as PricingFormula[],
  }
}

export async function submitInquiry(
  config: WidgetConfig,
  payload: InquiryPayload
): Promise<void> {
  const sb = createSupabaseClient(config)
  const { error } = await sb.from('inquiries').insert(payload as never)
  if (error) throw new Error(error.message)
}
