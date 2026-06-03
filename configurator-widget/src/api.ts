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

/** Shape of a row in the `tenant_texts` table — kept local to the widget so
 *  we don't have to re-export the admin's `database.ts` here. */
interface TextRow {
  level:        'tenant' | 'product' | 'characteristic' | 'characteristic_value'
  reference_id: string | null
  slot:         string
  language:     'en' | 'sr'
  content:      string
}

/** Build a `{ lang: content }` map from text rows that match a (level,
 *  reference_id, slot) triple, skipping empty strings. */
function textsToI18n(rows: TextRow[], level: TextRow['level'], referenceId: string | null, slot: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.level !== level || r.reference_id !== referenceId || r.slot !== slot) continue
    if (!r.content?.trim()) continue
    out[r.language] = r.content
  }
  return out
}

export async function loadProductConfig(config: WidgetConfig): Promise<FullProductConfig> {
  const sb = createSupabaseClient(config)

  // 1. Product — no longer reads the `_i18n` JSONB columns. The i18n map is
  //    rebuilt below from `tenant_texts`.
  const { data: product, error: productError } = await sb
    .from('products')
    .select('id, name, description, base_price, currency, ar_enabled, ar_placement, form_config, widget_theme, show_price_breakdown')
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
      ? sb.from('characteristics').select('id, name, display_type, sort_order, numeric_min, numeric_max').in('id', characteristicIds)
      : Promise.resolve({ data: [], error: null }),
    characteristicIds.length > 0
      ? sb.from('characteristic_values')
          .select('id, characteristic_id, label, price_modifier, sort_order, hex_color')
          .in('characteristic_id', characteristicIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    sb.from('visualization_assets')
      .select('id, characteristic_value_id, asset_type, url, is_default, sort_order, mesh_rules')
      .eq('product_id', config.productId)
      .order('sort_order', { ascending: true }),
    sb.from('configuration_rules')
      .select('id, condition, effects, is_active')
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

  const valueIds   = (valuesData ?? []).map((v: any) => v.id as string)
  const formulaIds = (formulasData ?? []).map((f: any) => f.id as string)

  // 4. Pull every text row this widget needs — tenant post-inquiry message,
  //    product name/description, every characteristic name, every value
  //    label, and every pricing-formula name — in a single query. RLS allows
  //    anonymous read of tenant_texts (see migration 076).
  const textFilterParts: string[] = [
    `and(level.eq.tenant,reference_id.is.null,slot.eq.post_inquiry_message)`,
    `and(level.eq.product,reference_id.eq.${config.productId})`,
  ]
  if (orderedCharIds.length > 0) {
    textFilterParts.push(`and(level.eq.characteristic,reference_id.in.(${orderedCharIds.join(',')}))`)
  }
  if (valueIds.length > 0) {
    textFilterParts.push(`and(level.eq.characteristic_value,reference_id.in.(${valueIds.join(',')}))`)
  }
  if (formulaIds.length > 0) {
    textFilterParts.push(`and(level.eq.pricing_formula,reference_id.in.(${formulaIds.join(',')}))`)
  }
  const { data: textsData } = await sb
    .from('tenant_texts')
    .select('level, reference_id, slot, language, content')
    .eq('tenant_id', config.tenantId)
    .or(textFilterParts.join(','))
  const textRows = (textsData ?? []) as TextRow[]

  // Fetch active scheduled price and modifier overrides for today
  const today    = new Date().toISOString().slice(0, 10)

  const [priceScheduleResult, modScheduleResult] = await Promise.all([
    sb.from('product_price_schedules')
      .select('price, valid_from')
      .eq('product_id', config.productId)
      .lte('valid_from', today)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .order('valid_from', { ascending: false })
      .limit(1),
    valueIds.length > 0
      ? sb.from('characteristic_modifier_schedules')
          .select('characteristic_value_id, price_modifier, valid_from')
          .in('characteristic_value_id', valueIds)
          .lte('valid_from', today)
          .or(`valid_to.is.null,valid_to.gte.${today}`)
          .order('valid_from', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  const scheduledBase     = (priceScheduleResult.data?.[0] as { price: number } | undefined)?.price
  const effectiveBasePrice = scheduledBase !== undefined
    ? Number(scheduledBase)
    : Number((product as any).base_price)

  const modByValueId: Record<string, number> = {}
  for (const r of (modScheduleResult.data ?? []) as Array<{ characteristic_value_id: string; price_modifier: number }>) {
    if (!(r.characteristic_value_id in modByValueId)) {
      modByValueId[r.characteristic_value_id] = Number(r.price_modifier)
    }
  }

  // Assemble characteristics with their values, in class-then-member order
  const valuesByCharId: Record<string, CharacteristicValue[]> = {}
  for (const v of (valuesData ?? []) as (CharacteristicValue & { characteristic_id: string })[]) {
    if (!valuesByCharId[v.characteristic_id]) valuesByCharId[v.characteristic_id] = []
    const sched = modByValueId[v.id]
    const labelI18n = textsToI18n(textRows, 'characteristic_value', v.id, 'label')
    const merged = { ...v, name_i18n: undefined, label_i18n: labelI18n } as CharacteristicValue
    valuesByCharId[v.characteristic_id].push(
      sched !== undefined ? { ...merged, price_modifier: sched } : merged
    )
  }

  const charById: Record<string, Characteristic> = {}
  for (const c of (charData ?? []) as Characteristic[]) {
    charById[c.id] = { ...c, name_i18n: textsToI18n(textRows, 'characteristic', c.id, 'name') }
  }

  const characteristics: Characteristic[] = orderedCharIds
    .filter(id => charById[id])
    .map(id => ({ ...charById[id], values: valuesByCharId[id] ?? [] }))

  // Load branding flag (tenant post-inquiry message comes from textRows).
  const brandingResult = await sb.rpc('get_widget_branding', { p_product_id: config.productId })

  if (brandingResult.error) {
    // Function not yet deployed — apply migration 039_plan_sync.sql to fix this
    console.warn('[konfigurator] get_widget_branding unavailable, branding badge will be shown:', brandingResult.error.message)
  }
  const removeBranding = !brandingResult.error && brandingResult.data === true

  const postInquiryRow = textRows.find(r =>
    r.level === 'tenant' && r.reference_id === null && r.slot === 'post_inquiry_message'
  )

  // Synthesise the i18n maps the widget UI still reads off the product object.
  const enrichedProduct: ProductData = {
    ...(product as ProductData),
    name_i18n:        textsToI18n(textRows, 'product', config.productId, 'name'),
    description_i18n: textsToI18n(textRows, 'product', config.productId, 'description'),
    base_price:       effectiveBasePrice,
  }

  return {
    product: enrichedProduct,
    characteristics,
    assets:    (assetsData    ?? []) as VisualizationAsset[],
    rules:     (rulesData     ?? []) as ConfigurationRule[],
    formulas:  ((formulasData ?? []) as PricingFormula[]).map(f => ({
      ...f,
      name_i18n: textsToI18n(textRows, 'pricing_formula', f.id, 'name'),
    })),
    removeBranding,
    postInquiryMessage: postInquiryRow?.content ?? null,
  }
}

/**
 * Thrown when the tenant has hit a plan-imposed quota or feature gate. The
 * widget UI catches this to render a friendly message instead of leaking
 * the raw DB exception text to the customer.
 */
export class PlanLimitError extends Error {
  code:    string
  plan?:   string
  limit?:  number
  current?: number
  constructor(detail: { code: string; plan?: string; limit?: number; current?: number }, message?: string) {
    super(message ?? detail.code)
    this.name    = 'PlanLimitError'
    this.code    = detail.code
    this.plan    = detail.plan
    this.limit   = detail.limit
    this.current = detail.current
  }
}

interface PostgrestErrorLike {
  message?: string
  details?: string
  code?:    string
}

function parsePlanLimitError(err: PostgrestErrorLike): PlanLimitError | null {
  // 1. Structured DETAIL JSON (added in migration 062)
  if (err.details) {
    try {
      const parsed = JSON.parse(err.details) as {
        code?:    string
        plan?:    string
        limit?:   number
        current?: number
      }
      if (parsed.code && (
        parsed.code === 'INQUIRY_LIMIT_EXCEEDED'
        || parsed.code === 'PRODUCT_LIMIT_EXCEEDED'
        || parsed.code === 'TEAM_LIMIT_EXCEEDED'
        || parsed.code === 'PLAN_FEATURE_DISABLED'
      )) {
        return new PlanLimitError({
          code:    parsed.code,
          plan:    parsed.plan,
          limit:   parsed.limit,
          current: parsed.current,
        }, err.message)
      }
    } catch { /* fall through */ }
  }
  // 2. Fallback: match on message prefix (pre-062 deployments)
  const msg = err.message ?? ''
  if (msg.startsWith('inquiry_limit_exceeded')) {
    return new PlanLimitError({ code: 'INQUIRY_LIMIT_EXCEEDED' }, msg)
  }
  if (msg.startsWith('plan_feature_disabled')) {
    return new PlanLimitError({ code: 'PLAN_FEATURE_DISABLED' }, msg)
  }
  return null
}

export async function submitInquiry(
  config: WidgetConfig,
  payload: InquiryPayload
): Promise<void> {
  const sb = createSupabaseClient(config)
  const { error } = await sb.from('inquiries').insert(payload as never)
  if (error) {
    const planErr = parsePlanLimitError(error as PostgrestErrorLike)
    if (planErr) throw planErr
    throw new Error(error.message)
  }
}
