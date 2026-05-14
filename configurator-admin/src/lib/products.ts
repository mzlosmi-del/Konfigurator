/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: `as any` casts on insert/update calls work around a supabase-js v2
// generic inference issue with hand-written Database types. The consuming
// components remain fully typed via the return types.
import { supabase } from './supabase'
import type {
  Product,
  Characteristic,
  CharacteristicClass,
  ClassMember,
  CharacteristicValue,
  ProductCharacteristic,
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
    & { sku?: string | null; unit_of_measure?: string | null; show_price_breakdown?: boolean }
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
  input: Partial<Pick<Product, 'name' | 'description' | 'base_price' | 'currency' | 'status' | 'sku' | 'unit_of_measure' | 'ar_enabled' | 'ar_placement' | 'form_config' | 'public_preview_enabled' | 'show_price_breakdown'>>
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
  const { error } = await supabase
    .from('characteristic_class_members')
    .insert({ class_id: classId, characteristic_id: charId } as any)
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
  input: Partial<Pick<Characteristic, 'name' | 'display_type'>>
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
