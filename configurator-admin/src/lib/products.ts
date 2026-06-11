/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: `as any` casts on insert/update calls work around a supabase-js v2
// generic inference issue with hand-written Database types. The consuming
// components remain fully typed via the return types.
import { supabase } from './supabase'
import { storagePathForAssetUrl, PRODUCT_ASSETS_BUCKET } from './assets'
import { applyCharacteristicOrder, type CharOrderRow } from './charOrder'
import type {
  Product,
  Characteristic,
  CharacteristicClass,
  ClassMember,
  CharacteristicValue,
  ProductCharacteristic,
  ConfigurationRule,
  PricingFormula,
  RulePredicate,
  RuleEffect,
  NumExpr,
  FormulaNode,
} from '@/types/database'

// Enriched type returned by fetchProductClassesWithChars
export type ProductClassWithChars = CharacteristicClass & {
  sort_order: number
  characteristics: Characteristic[]
}

export type CharacteristicWithValues = Characteristic & {
  characteristic_values: CharacteristicValue[]
}

export type ProductCharacteristicWithDetails = {
  sort_order: number
  characteristic: CharacteristicWithValues
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_template', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return enrichProductsWithTexts((data ?? []) as Product[])
}

/** Populate the in-memory `name_i18n` / `description_i18n` maps on each
 *  product from `tenant_texts`. The JSONB columns were dropped in
 *  migration 078; the admin's I18nEditors still expect the maps. */
async function enrichProductsWithTexts(rows: Product[]): Promise<Product[]> {
  if (rows.length === 0) return rows
  const ids = rows.map(p => p.id)
  const { data: textRows } = await supabase
    .from('tenant_texts')
    .select('reference_id, slot, language, content')
    .eq('level', 'product')
    .in('reference_id', ids)
  const byId: Record<string, { name_i18n: Record<string,string>; description_i18n: Record<string,string> }> = {}
  for (const p of rows) byId[p.id] = { name_i18n: {}, description_i18n: {} }
  for (const r of (textRows ?? []) as { reference_id: string; slot: string; language: string; content: string }[]) {
    if (!r.content?.trim()) continue
    const t = byId[r.reference_id]
    if (!t) continue
    if (r.slot === 'name')        t.name_i18n[r.language]        = r.content
    if (r.slot === 'description') t.description_i18n[r.language] = r.content
  }
  return rows.map(p => ({
    ...p,
    name_i18n:        byId[p.id].name_i18n,
    description_i18n: byId[p.id].description_i18n,
  }))
}

export async function fetchPublishedProductCount(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_template', false)
    .eq('status', 'published')
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  const enriched = await enrichProductsWithTexts([data as Product])
  return enriched[0]
}

export async function createProduct(
  input: Pick<Product, 'name' | 'description' | 'base_price' | 'currency'>
    & { sku?: string | null; unit_of_measure?: string | null; show_price_breakdown?: boolean; group_into_tabs?: boolean }
): Promise<Product> {
  // i18n maps no longer go through this call — they are persisted in
  // tenant_texts via `setEntityI18nText` from the inline editors.
  const { data, error } = await supabase
    .from('products')
    .insert(input as any)
    .select()
    .single()
  if (error) {
    // DB trigger raises JSON: {"code":"PLAN_LIMIT_EXCEEDED","dimension":"products",...}
    if (error.message.includes('PLAN_LIMIT_EXCEEDED') || error.message.includes('plan_limit_exceeded')) {
      let detail = ''
      try {
        const parsed = JSON.parse(error.message) as { plan?: string; limit?: number }
        if (parsed.plan) detail = ` (${parsed.plan} plan: ${parsed.limit} max)`
      } catch { /* not JSON */ }
      throw new Error(`Product limit reached${detail}. Upgrade your plan to add more products.`)
    }
    throw new Error(error.message)
  }
  return data as Product
}

export async function updateProduct(
  id: string,
  /** i18n maps are stored in `tenant_texts` (see `setEntityI18nText`). This
   *  function only persists the scalar product columns. */
  input: Partial<Pick<Product, 'name' | 'description' | 'base_price' | 'currency' | 'status' | 'sku' | 'unit_of_measure' | 'ar_enabled' | 'ar_placement' | 'form_config' | 'public_preview_enabled' | 'show_price_breakdown' | 'group_into_tabs' | 'uploads_possible' | 'preview_defaults'>>
): Promise<Product> {
  // Strip any stray i18n keys callers might still pass in during the
  // deprecation window — Postgres will reject them now that 078 dropped
  // the columns.
  const sanitised = { ...input } as Record<string, unknown>
  delete sanitised.name_i18n
  delete sanitised.description_i18n
  const { data, error } = await supabase
    .from('products')
    .update(sanitised as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Product
}

export async function deleteProduct(id: string): Promise<void> {
  // Collect storage paths for any files we host, so we can clean them up.
  const { data: assetRows } = await supabase
    .from('visualization_assets')
    .select('url')
    .eq('product_id', id)

  const rows = (assetRows ?? []) as { url: string }[]
  const paths = rows
    .map(r => storagePathForAssetUrl(r.url))
    .filter((p): p is string => p !== null)

  if (paths.length > 0) {
    // Best-effort — never block the delete on a storage failure.
    await supabase.storage.from(PRODUCT_ASSETS_BUCKET).remove(paths).catch(() => {})
  }

  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Characteristic Classes ───────────────────────────────────────────────────

export async function fetchClasses(): Promise<CharacteristicClass[]> {
  const { data, error } = await supabase
    .from('characteristic_classes')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CharacteristicClass[]
}

export async function createClass(input: Pick<CharacteristicClass, 'name'> & { name_i18n?: Record<string,string> }): Promise<CharacteristicClass> {
  const { data, error } = await supabase
    .from('characteristic_classes')
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CharacteristicClass
}

export async function updateClass(
  id: string,
  input: Partial<Pick<CharacteristicClass, 'name' | 'sort_order'>> & { name_i18n?: Record<string,string> }
): Promise<CharacteristicClass> {
  const { data, error } = await supabase
    .from('characteristic_classes')
    .update(input as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CharacteristicClass
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('characteristic_classes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchAllMemberships(): Promise<ClassMember[]> {
  const { data, error } = await supabase
    .from('characteristic_class_members')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClassMember[]
}

export async function addCharacteristicToClass(classId: string, charId: string): Promise<void> {
  // Append at the end of the class so new members land in a deterministic
  // position (the Library can drag-reorder members within a class afterwards).
  const { data: maxRow } = await supabase
    .from('characteristic_class_members')
    .select('sort_order')
    .eq('class_id', classId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const maxOrder = (maxRow as { sort_order: number } | null)?.sort_order
  const nextOrder = (maxOrder ?? -1) + 1
  const { error } = await supabase
    .from('characteristic_class_members')
    .insert({ class_id: classId, characteristic_id: charId, sort_order: nextOrder } as any)
  if (error) throw new Error(error.message)
}

export async function removeCharacteristicFromClass(classId: string, charId: string): Promise<void> {
  const { error } = await supabase
    .from('characteristic_class_members')
    .delete()
    .eq('class_id', classId)
    .eq('characteristic_id', charId)
  if (error) throw new Error(error.message)
}

// Reorder members within a class: apply new sort_order values in a batch.
// Mirrors reorderAssets in lib/assets.ts.
export async function reorderClassMembers(
  classId: string,
  updates: { characteristic_id: string; sort_order: number }[],
): Promise<void> {
  await Promise.all(
    updates.map(({ characteristic_id, sort_order }) =>
      supabase
        .from('characteristic_class_members')
        .update({ sort_order } as unknown as never)
        .eq('class_id', classId)
        .eq('characteristic_id', characteristic_id)
    )
  )
}

// ─── Product ↔ Class assignments ─────────────────────────────────────────────

export async function fetchProductClassesWithChars(
  productId: string
): Promise<ProductClassWithChars[]> {
  const { data: pcData, error: pcError } = await supabase
    .from('product_classes')
    .select('class_id, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  if (pcError) throw new Error(pcError.message)
  if (!pcData || pcData.length === 0) return []

  const classIds = (pcData as any[]).map(pc => pc.class_id as string)

  const [classResult, memberResult] = await Promise.all([
    supabase.from('characteristic_classes').select('*').in('id', classIds),
    supabase.from('characteristic_class_members')
      .select('class_id, characteristic_id, sort_order')
      .in('class_id', classIds)
      .order('sort_order', { ascending: true }),
  ])
  if (classResult.error) throw new Error(classResult.error.message)
  if (memberResult.error) throw new Error(memberResult.error.message)

  const charIds = [...new Set((memberResult.data ?? []).map((m: any) => m.characteristic_id as string))]
  const charResult = charIds.length > 0
    ? await supabase.from('characteristics').select('*').in('id', charIds)
    : { data: [], error: null }
  if (charResult.error) throw new Error(charResult.error.message)

  const charById: Record<string, Characteristic> = {}
  for (const c of (charResult.data ?? []) as Characteristic[]) charById[c.id] = c

  const membersByClass: Record<string, Characteristic[]> = {}
  for (const m of (memberResult.data ?? []) as any[]) {
    if (!membersByClass[m.class_id]) membersByClass[m.class_id] = []
    if (charById[m.characteristic_id]) membersByClass[m.class_id].push(charById[m.characteristic_id])
  }

  return (pcData as any[]).map(pc => {
    const cls = (classResult.data ?? []).find((c: any) => c.id === pc.class_id) as unknown as CharacteristicClass
    return { ...cls, sort_order: pc.sort_order as number, characteristics: membersByClass[pc.class_id as string] ?? [] }
  })
}

/**
 * Fetch a product's characteristics as a single flat, ordered, de-duplicated
 * list — the order the widget will render them in. Built from the class-derived
 * order (fetchProductClassesWithChars) with the per-product
 * product_characteristic_order override applied on top.
 */
export async function fetchProductCharacteristicsOrdered(
  productId: string
): Promise<Characteristic[]> {
  const classes = await fetchProductClassesWithChars(productId)

  // Flatten + dedup, preserving class-then-member order (first occurrence wins).
  const byId = new Map<string, Characteristic>()
  for (const cls of classes) {
    for (const char of cls.characteristics) {
      if (!byId.has(char.id)) byId.set(char.id, char)
    }
  }
  const classDerivedIds = [...byId.keys()]

  const { data: overrides, error } = await supabase
    .from('product_characteristic_order')
    .select('characteristic_id, sort_order')
    .eq('product_id', productId)
  if (error) throw new Error(error.message)

  const orderedIds = applyCharacteristicOrder(classDerivedIds, (overrides ?? []) as CharOrderRow[])
  return orderedIds.map(id => byId.get(id)!).filter(Boolean)
}

/**
 * Persist a flat per-product characteristic order. Writes one row per id with
 * its index as sort_order, and removes any stale rows for characteristics no
 * longer in the list (e.g. a class was detached).
 */
export async function saveProductCharacteristicOrder(
  productId: string,
  orderedCharacteristicIds: string[]
): Promise<void> {
  const rows = orderedCharacteristicIds.map((characteristic_id, i) => ({
    product_id: productId,
    characteristic_id,
    sort_order: i,
  }))

  const { error: upsertError } = await supabase
    .from('product_characteristic_order')
    .upsert(rows as any, { onConflict: 'product_id,characteristic_id' })
  if (upsertError) throw new Error(upsertError.message)

  // Drop rows for characteristics that are no longer part of the product.
  let del = supabase
    .from('product_characteristic_order')
    .delete()
    .eq('product_id', productId)
  if (orderedCharacteristicIds.length > 0) {
    del = del.not('characteristic_id', 'in', `(${orderedCharacteristicIds.join(',')})`)
  }
  const { error: deleteError } = await del
  if (deleteError) throw new Error(deleteError.message)
}

export async function attachClassToProduct(
  productId: string, classId: string, sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('product_classes')
    .insert({ product_id: productId, class_id: classId, sort_order: sortOrder } as any)
  if (error) throw new Error(error.message)
}

export async function detachClassFromProduct(
  productId: string, classId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_classes')
    .delete()
    .eq('product_id', productId)
    .eq('class_id', classId)
  if (error) throw new Error(error.message)
}

// ─── Characteristics ─────────────────────────────────────────────────────────

export async function fetchCharacteristics(): Promise<Characteristic[]> {
  const { data, error } = await supabase
    .from('characteristics')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Characteristic[]
  return enrichCharacteristicsWithTexts(rows)
}

/** Populate the in-memory `name_i18n` / `description_i18n` maps on each
 *  characteristic by reading `tenant_texts`. Called by every fetch that
 *  returns characteristics so the admin's I18nEditors and `pickTranslation`
 *  lookups keep showing translated copy after migration 078 dropped the
 *  JSONB columns from `characteristics`. */
async function enrichCharacteristicsWithTexts(chars: Characteristic[]): Promise<Characteristic[]> {
  if (chars.length === 0) return chars
  const ids = chars.map(c => c.id)
  const { data: textRows } = await supabase
    .from('tenant_texts')
    .select('reference_id, slot, language, content')
    .eq('level', 'characteristic')
    .in('reference_id', ids)
  const rows = (textRows ?? []) as { reference_id: string; slot: string; language: string; content: string }[]
  const byId: Record<string, { name_i18n: Record<string,string>; description_i18n: Record<string,string> }> = {}
  for (const c of chars) byId[c.id] = { name_i18n: {}, description_i18n: {} }
  for (const r of rows) {
    if (!r.content?.trim()) continue
    const target = byId[r.reference_id]
    if (!target) continue
    if (r.slot === 'name')        target.name_i18n[r.language]        = r.content
    if (r.slot === 'description') target.description_i18n[r.language] = r.content
  }
  return chars.map(c => ({
    ...c,
    name_i18n:        byId[c.id].name_i18n,
    description_i18n: byId[c.id].description_i18n,
  }))
}

export async function createCharacteristic(
  input: Pick<Characteristic, 'name' | 'display_type'>
): Promise<Characteristic> {
  const { data, error } = await supabase
    .from('characteristics')
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Characteristic
}

export async function updateCharacteristic(
  id: string,
  /** i18n maps now live in `tenant_texts`; only scalar columns are persisted here. */
  input: Partial<Pick<Characteristic, 'name' | 'display_type' | 'numeric_min' | 'numeric_max' | 'price_per_char' | 'color_price_modifier' | 'neon_config'>>
): Promise<Characteristic> {
  const sanitised = { ...input } as Record<string, unknown>
  delete sanitised.name_i18n
  delete sanitised.description_i18n
  const { data, error } = await supabase
    .from('characteristics')
    .update(sanitised as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Characteristic
}

export async function deleteCharacteristic(id: string): Promise<void> {
  const { error } = await supabase.from('characteristics').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Cascade-aware deletion ──────────────────────────────────────────────────
// `tenant_texts.reference_id` has no FK and no trigger (see migration 076), so
// deleting a characteristic leaves orphan text rows behind. Configuration rules
// and pricing formulas reference char/value IDs inside JSONB, also un-FK'd —
// they keep dead references and silently never match again. The two helpers
// below let the UI surface every consequence to the user before deleting, then
// clean everything up in one go.
//
// Quotation/inquiry snapshots (`line_items[].configuration[]`) are intentionally
// left alone — they are point-in-time records and must keep their original IDs.

export interface CharacteristicDeletionPreview {
  characteristic: { id: string; name: string }
  /** Values that will be deleted alongside the characteristic (DB cascade). */
  values:         { id: string; label: string }[]
  /** Centralised text rows that will become orphan (level=characteristic). */
  characteristicTextRows: number
  /** Centralised text rows for any of this char's values (level=characteristic_value). */
  valueTextRows:          number
  /** Configuration rules whose JSONB references the char or any of its values. */
  affectedRules:    { id: string; product_id: string; product_name: string }[]
  /** Pricing formulas whose JSONB references the char or any of its values. */
  affectedFormulas: { id: string; product_id: string; product_name: string; name: string }[]
  /** Products this char is currently attached to (relationship will be removed). */
  attachedProducts: { id: string; name: string }[]
  /** Classes this char belongs to (membership will be removed). */
  attachedClasses:  { id: string; name: string }[]
  /** visualization_assets whose `characteristic_value_id` points at one of
   *  this char's values. The DB sets that column to NULL on cascade — the
   *  asset rows survive but are detached from any value. */
  detachedAssets:   number
}

function numExprReferences(expr: NumExpr, charId: string): boolean {
  if (expr.type === 'number') return false
  if (expr.type === 'input')  return expr.char_id === charId
  return numExprReferences(expr.left, charId) || numExprReferences(expr.right, charId)
}

function predicateReferences(p: RulePredicate, charId: string, valueIds: Set<string>): boolean {
  if (p.type === 'select_eq' || p.type === 'select_neq') {
    return p.char_id === charId || valueIds.has(p.value_id)
  }
  return numExprReferences(p.left, charId) || numExprReferences(p.right, charId)
}

function effectReferences(e: RuleEffect, charId: string, valueIds: Set<string>): boolean {
  switch (e.type) {
    case 'hide_value':
    case 'disable_value':
      return valueIds.has(e.value_id)
    case 'set_value_default':
    case 'set_value_locked':
      return e.char_id === charId || valueIds.has(e.value_id)
    case 'set_numeric_default':
    case 'set_numeric_locked':
      return e.char_id === charId || numExprReferences(e.expr, charId)
  }
}

function ruleReferences(rule: ConfigurationRule, charId: string, valueIds: Set<string>): boolean {
  if (rule.condition.predicates.some(p => predicateReferences(p, charId, valueIds))) return true
  return rule.effects.some(e => effectReferences(e, charId, valueIds))
}

function formulaReferences(node: FormulaNode, charId: string, valueIds: Set<string>): boolean {
  switch (node.type) {
    case 'number':
    case 'base_price':
    case 'formula_result':
      return false
    case 'modifier':
    case 'input':
      return node.char_id === charId
    case 'is_selected':
      return node.char_id === charId || valueIds.has(node.value_id)
    case 'add': case 'subtract': case 'multiply': case 'divide':
    case 'gt':  case 'gte':      case 'lt':       case 'lte': case 'eq':
    case 'and': case 'or':
      return formulaReferences(node.left, charId, valueIds)
          || formulaReferences(node.right, charId, valueIds)
    case 'if':
      return formulaReferences(node.condition, charId, valueIds)
          || formulaReferences(node.then,      charId, valueIds)
          || formulaReferences(node.else_node, charId, valueIds)
  }
}

export async function previewCharacteristicDeletion(
  charId: string,
): Promise<CharacteristicDeletionPreview> {
  const { data: charRow, error: charErr } = await supabase
    .from('characteristics').select('id, name').eq('id', charId).single()
  if (charErr || !charRow) throw new Error(charErr?.message ?? 'Characteristic not found')
  const characteristic = charRow as { id: string; name: string }

  const { data: valueRows } = await supabase
    .from('characteristic_values').select('id, label').eq('characteristic_id', charId)
  const values   = (valueRows ?? []) as { id: string; label: string }[]
  const valueIds = new Set(values.map(v => v.id))

  // tenant_texts at characteristic level
  const { count: charTextCount } = await supabase
    .from('tenant_texts').select('id', { count: 'exact', head: true })
    .eq('level', 'characteristic').eq('reference_id', charId)
  // tenant_texts at characteristic_value level (skip the IN query when there are no values)
  let valueTextCount = 0
  if (values.length > 0) {
    const { count } = await supabase
      .from('tenant_texts').select('id', { count: 'exact', head: true })
      .eq('level', 'characteristic_value').in('reference_id', [...valueIds])
    valueTextCount = count ?? 0
  }

  // visualization_assets that would lose their value link
  let detachedAssets = 0
  if (values.length > 0) {
    const { count } = await supabase
      .from('visualization_assets').select('id', { count: 'exact', head: true })
      .in('characteristic_value_id', [...valueIds])
    detachedAssets = count ?? 0
  }

  // Products this char is attached to
  const { data: pcRows } = await supabase
    .from('product_characteristics').select('product_id').eq('characteristic_id', charId)
  const productIds = [...new Set((pcRows ?? []).map(r => (r as { product_id: string }).product_id))]
  const { data: prodRows } = productIds.length > 0
    ? await supabase.from('products').select('id, name').in('id', productIds)
    : { data: [] as { id: string; name: string }[] }
  const attachedProducts = (prodRows ?? []) as { id: string; name: string }[]

  // Classes this char belongs to
  const { data: clsMemberRows } = await supabase
    .from('characteristic_class_members').select('class_id').eq('characteristic_id', charId)
  const classIds = [...new Set((clsMemberRows ?? []).map(r => (r as { class_id: string }).class_id))]
  const { data: clsRows } = classIds.length > 0
    ? await supabase.from('characteristic_classes').select('id, name').in('id', classIds)
    : { data: [] as { id: string; name: string }[] }
  const attachedClasses = (clsRows ?? []) as { id: string; name: string }[]

  // Rules + formulas. Rules and formulas live on products, but we have to walk
  // their JSONB to find references — there's no SQL operator that does this
  // cleanly across every shape. Tenant volume is small enough to fetch all and
  // filter in JS.
  const productNameById = new Map<string, string>(attachedProducts.map(p => [p.id, p.name]))
  // Pull names for any product that owns a rule/formula but isn't yet in the map.
  const affectedRules:    CharacteristicDeletionPreview['affectedRules']    = []
  const affectedFormulas: CharacteristicDeletionPreview['affectedFormulas'] = []

  if (productIds.length > 0) {
    const { data: ruleRows } = await supabase
      .from('configuration_rules').select('id, product_id, condition, effects')
      .in('product_id', productIds)
    for (const r of (ruleRows ?? []) as ConfigurationRule[]) {
      if (ruleReferences(r, charId, valueIds)) {
        affectedRules.push({
          id:           r.id,
          product_id:   r.product_id,
          product_name: productNameById.get(r.product_id) ?? '',
        })
      }
    }

    const { data: formulaRows } = await supabase
      .from('pricing_formulas').select('id, product_id, name, formula')
      .in('product_id', productIds)
    for (const f of (formulaRows ?? []) as PricingFormula[]) {
      if (formulaReferences(f.formula as unknown as FormulaNode, charId, valueIds)) {
        affectedFormulas.push({
          id:           f.id,
          product_id:   f.product_id,
          product_name: productNameById.get(f.product_id) ?? '',
          name:         f.name,
        })
      }
    }
  }

  return {
    characteristic,
    values,
    characteristicTextRows: charTextCount ?? 0,
    valueTextRows:          valueTextCount,
    affectedRules,
    affectedFormulas,
    attachedProducts,
    attachedClasses,
    detachedAssets,
  }
}

/**
 * Cleans up everything that won't be touched by the DB cascade, then deletes
 * the characteristic itself. Idempotent w.r.t. orphan rows: if a previous
 * delete attempt failed mid-way and you retry, the second pass simply has
 * fewer orphans to clean.
 *
 * Order matters: rules/formulas/texts first (they would otherwise hold dead
 * references), then the characteristic (which cascade-deletes values,
 * product_characteristics, class memberships, and detaches visualization
 * assets via SET NULL).
 */
export async function deleteCharacteristicCascade(charId: string): Promise<void> {
  const preview = await previewCharacteristicDeletion(charId)
  const valueIds = preview.values.map(v => v.id)

  // 1. tenant_texts (characteristic level)
  if (preview.characteristicTextRows > 0) {
    const { error } = await supabase.from('tenant_texts')
      .delete().eq('level', 'characteristic').eq('reference_id', charId)
    if (error) throw new Error(`Failed to remove characteristic texts: ${error.message}`)
  }
  // 2. tenant_texts (value level)
  if (valueIds.length > 0 && preview.valueTextRows > 0) {
    const { error } = await supabase.from('tenant_texts')
      .delete().eq('level', 'characteristic_value').in('reference_id', valueIds)
    if (error) throw new Error(`Failed to remove value texts: ${error.message}`)
  }
  // 3. configuration_rules (delete entire rule when it references char/values)
  if (preview.affectedRules.length > 0) {
    const { error } = await supabase.from('configuration_rules')
      .delete().in('id', preview.affectedRules.map(r => r.id))
    if (error) throw new Error(`Failed to remove rules: ${error.message}`)
  }
  // 4. pricing_formulas (same — drop the whole formula)
  if (preview.affectedFormulas.length > 0) {
    const { error } = await supabase.from('pricing_formulas')
      .delete().in('id', preview.affectedFormulas.map(f => f.id))
    if (error) throw new Error(`Failed to remove formulas: ${error.message}`)
  }
  // 5. The characteristic itself — DB cascades values, product_characteristics,
  //    class memberships, and SET NULL on visualization_assets.
  const { error } = await supabase.from('characteristics').delete().eq('id', charId)
  if (error) throw new Error(error.message)
}

// ─── Characteristic Values ───────────────────────────────────────────────────

export async function fetchValuesForCharacteristic(
  characteristicId: string
): Promise<CharacteristicValue[]> {
  const { data, error } = await supabase
    .from('characteristic_values')
    .select('*')
    .eq('characteristic_id', characteristicId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as CharacteristicValue[]
  if (rows.length === 0) return rows
  // Hydrate `label_i18n` from tenant_texts (the JSONB column was dropped).
  const ids = rows.map(v => v.id)
  const { data: textRows } = await supabase
    .from('tenant_texts')
    .select('reference_id, language, content')
    .eq('level', 'characteristic_value')
    .eq('slot', 'label')
    .in('reference_id', ids)
  const labelById: Record<string, Record<string, string>> = {}
  for (const v of rows) labelById[v.id] = {}
  for (const r of (textRows ?? []) as { reference_id: string; language: string; content: string }[]) {
    if (!r.content?.trim()) continue
    const t = labelById[r.reference_id]
    if (t) t[r.language] = r.content
  }
  return rows.map(v => ({ ...v, label_i18n: labelById[v.id] }))
}

export async function createCharacteristicValue(
  input: Pick<CharacteristicValue, 'characteristic_id' | 'label' | 'price_modifier' | 'sort_order'>
    & { tenant_id: string }
): Promise<CharacteristicValue> {
  const { data, error } = await supabase
    .from('characteristic_values')
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CharacteristicValue
}

export async function updateCharacteristicValue(
  id: string,
  /** Label i18n now goes through `tenant_texts.setEntityI18nText`. */
  input: Partial<Pick<CharacteristicValue, 'label' | 'price_modifier' | 'sort_order' | 'hex_color'>>
): Promise<CharacteristicValue> {
  const sanitised = { ...input } as Record<string, unknown>
  delete sanitised.label_i18n
  const { data, error } = await supabase
    .from('characteristic_values')
    .update(sanitised as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CharacteristicValue
}

export async function deleteCharacteristicValue(id: string): Promise<void> {
  const { error } = await supabase.from('characteristic_values').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Product ↔ Characteristic attachments ────────────────────────────────────

export async function fetchProductCharacteristics(
  productId: string
): Promise<(ProductCharacteristic & { characteristic: Characteristic })[]> {
  const { data, error } = await supabase
    .from('product_characteristics')
    .select('*, characteristic:characteristics(*)')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as (ProductCharacteristic & { characteristic: Characteristic })[]
}

export async function attachCharacteristicToProduct(
  productId: string,
  characteristicId: string,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('product_characteristics')
    .insert({
      product_id: productId,
      characteristic_id: characteristicId,
      is_required: true,
      sort_order: sortOrder,
    } as any)
  if (error) throw new Error(error.message)
}

export async function detachCharacteristicFromProduct(
  productId: string,
  characteristicId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_characteristics')
    .delete()
    .eq('product_id', productId)
    .eq('characteristic_id', characteristicId)
  if (error) throw new Error(error.message)
}

export async function fetchProductWithDetails(
  productId: string
): Promise<ProductCharacteristicWithDetails[]> {
  const { data, error } = await supabase
    .from('product_characteristics')
    .select(`
      sort_order,
      characteristic:characteristics(
        id, tenant_id, name, display_type, sort_order, created_at, updated_at,
        characteristic_values(id, characteristic_id, tenant_id, label, price_modifier, sort_order, created_at, updated_at)
      )
    `)
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProductCharacteristicWithDetails[]
}

// ─── Characteristics via the active classes path ──────────────────────────────
// Uses product_classes → characteristic_class_members → characteristics → values.
// This is the current model; fetchProductWithDetails uses the legacy direct table.

export async function fetchProductCharacteristicsWithValues(
  productId: string
): Promise<CharacteristicWithValues[]> {
  const { data: pcData, error: pcError } = await supabase
    .from('product_classes')
    .select('class_id, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  if (pcError) throw new Error(pcError.message)
  if (!pcData || pcData.length === 0) return []

  const classIds = (pcData as any[]).map(pc => pc.class_id as string)

  const { data: memberData, error: memberError } = await supabase
    .from('characteristic_class_members')
    .select('class_id, characteristic_id, sort_order')
    .in('class_id', classIds)
    .order('sort_order', { ascending: true })
  if (memberError) throw new Error(memberError.message)

  // Build an ordered, deduplicated list of characteristic IDs
  const seen = new Set<string>()
  const orderedCharIds: string[] = []
  for (const pc of (pcData as any[])) {
    const members = ((memberData ?? []) as any[])
      .filter(m => m.class_id === pc.class_id)
      .sort((a, b) => a.sort_order - b.sort_order)
    for (const m of members) {
      if (!seen.has(m.characteristic_id)) {
        seen.add(m.characteristic_id)
        orderedCharIds.push(m.characteristic_id)
      }
    }
  }
  if (orderedCharIds.length === 0) return []

  const [charResult, valueResult] = await Promise.all([
    supabase.from('characteristics').select('*').in('id', orderedCharIds),
    supabase.from('characteristic_values').select('*').in('characteristic_id', orderedCharIds).order('sort_order', { ascending: true }),
  ])
  if (charResult.error) throw new Error(charResult.error.message)
  if (valueResult.error) throw new Error(valueResult.error.message)

  // Hydrate `name_i18n` / `description_i18n` (chars) and `label_i18n`
  // (values) from tenant_texts — they aren't real columns anymore.
  const valueIds = (valueResult.data ?? []).map((v: { id: string }) => v.id)
  const allTextScopes = [
    `and(level.eq.characteristic,reference_id.in.(${orderedCharIds.join(',')}))`,
    valueIds.length > 0
      ? `and(level.eq.characteristic_value,reference_id.in.(${valueIds.join(',')}))`
      : null,
  ].filter(Boolean).join(',')
  const { data: textRows } = allTextScopes
    ? await supabase.from('tenant_texts')
        .select('level, reference_id, slot, language, content')
        .or(allTextScopes)
    : { data: [] }
  const rows = (textRows ?? []) as { level: string; reference_id: string; slot: string; language: string; content: string }[]

  const charById: Record<string, Characteristic> = {}
  for (const c of (charResult.data ?? []) as Characteristic[]) {
    const name_i18n:        Record<string, string> = {}
    const description_i18n: Record<string, string> = {}
    for (const r of rows) {
      if (r.level !== 'characteristic' || r.reference_id !== c.id || !r.content?.trim()) continue
      if (r.slot === 'name')        name_i18n[r.language]        = r.content
      if (r.slot === 'description') description_i18n[r.language] = r.content
    }
    charById[c.id] = { ...c, name_i18n, description_i18n }
  }

  const valuesByChar: Record<string, CharacteristicValue[]> = {}
  for (const v of (valueResult.data ?? []) as CharacteristicValue[]) {
    if (!valuesByChar[v.characteristic_id]) valuesByChar[v.characteristic_id] = []
    const label_i18n: Record<string, string> = {}
    for (const r of rows) {
      if (r.level === 'characteristic_value' && r.reference_id === v.id && r.slot === 'label' && r.content?.trim()) {
        label_i18n[r.language] = r.content
      }
    }
    valuesByChar[v.characteristic_id].push({ ...v, label_i18n })
  }

  return orderedCharIds
    .filter(id => charById[id])
    .map(id => ({ ...charById[id], characteristic_values: valuesByChar[id] ?? [] }))
}

// ─── Product Texts ────────────────────────────────────────────────────────────
//
// The legacy `product_texts` table was dropped by migration 078. Its rows
// were migrated into `tenant_texts` (level='product' | 'tenant', slot in
// product/specification/note/terms). Use the helpers in `lib/texts.ts`
// (`fetchTexts`, `upsertText`, `resolveProductTextBlocks`, etc.) instead.
