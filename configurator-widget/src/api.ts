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

  // 2. Product's assigned classes (ordered)
  const { data: productClasses, error: pcError } = await sb
    .from('product_classes')
    .select('class_id, sort_order')
    .eq('product_id', config.productId)
    .order('sort_order', { ascending: true })

  if (pcError) throw new Error('Failed to load product classes')

  const classIds = (productClasses ?? []).map((pc: { class_id: string }) => pc.class_id)

  // 3. Characteristic IDs via class memberships (ordered within each class)
  const { data: members, error: memberError } = classIds.length > 0
    ? await sb.from('characteristic_class_members')
        .select('characteristic_id, class_id, sort_order')
        .in('class_id', classIds)
        .order('sort_order', { ascending: true })
    : { data: [], error: null }

  if (memberError) throw new Error('Failed to load class memberships')

  // Deduplicate: a characteristic can be in multiple classes — show it once
  // Order: by class sort_order first, then by characteristic sort_order within class
  const classOrder: Record<string, number> = {}
  for (const pc of productClasses ?? []) classOrder[(pc as any).class_id] = (pc as any).sort_order

  const seen = new Set<string>()
  const orderedCharIds: string[] = []
  const sortedMembers = [...(members ?? [])].sort(
    (a: any, b: any) => (classOrder[a.class_id] ?? 0) - (classOrder[b.class_id] ?? 0) || a.sort_order - b.sort_order
  )
  for (const m of sortedMembers as any[]) {
    if (!seen.has(m.characteristic_id)) {
      seen.add(m.characteristic_id)
      orderedCharIds.push(m.characteristic_id)
    }
  }

  const characteristicIds = orderedCharIds

  // Load assets, rules and formulas in parallel with characteristic data.
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

  // Assemble characteristics with their values, in class-then-member order
  const valuesByCharId: Record<string, CharacteristicValue[]> = {}
  for (const v of (valuesData ?? []) as (CharacteristicValue & { characteristic_id: string })[]) {
    if (!valuesByCharId[v.characteristic_id]) valuesByCharId[v.characteristic_id] = []
    valuesByCharId[v.characteristic_id].push(v)
  }

  const charById: Record<string, Characteristic> = {}
  for (const c of (charData ?? []) as Characteristic[]) charById[c.id] = c

  const characteristics: Characteristic[] = orderedCharIds
    .filter(id => charById[id])
    .map(id => ({ ...charById[id], values: valuesByCharId[id] ?? [] }))

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
