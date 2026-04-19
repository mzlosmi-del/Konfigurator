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
  ProductText,
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
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Product[]
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as Product
}

export async function createProduct(
  input: Pick<Product, 'name' | 'description' | 'base_price' | 'currency'>
    & { sku?: string | null; unit_of_measure?: string | null }
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Product
}

export async function updateProduct(
  id: string,
  input: Partial<Pick<Product, 'name' | 'description' | 'base_price' | 'currency' | 'status' | 'sku' | 'unit_of_measure'>>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(input as unknown as never)
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

export async function createClass(input: Pick<CharacteristicClass, 'name'>): Promise<CharacteristicClass> {
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
  input: Partial<Pick<CharacteristicClass, 'name' | 'sort_order'>>
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
  return (data ?? []) as Characteristic[]
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
  input: Partial<Pick<Characteristic, 'name' | 'display_type'>>
): Promise<Characteristic> {
  const { data, error } = await supabase
    .from('characteristics')
    .update(input as unknown as never)
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
  return (data ?? []) as CharacteristicValue[]
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
  input: Partial<Pick<CharacteristicValue, 'label' | 'price_modifier' | 'sort_order'>>
): Promise<CharacteristicValue> {
  const { data, error } = await supabase
    .from('characteristic_values')
    .update(input as unknown as never)
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

  const charById: Record<string, Characteristic> = {}
  for (const c of (charResult.data ?? []) as Characteristic[]) charById[c.id] = c

  const valuesByChar: Record<string, CharacteristicValue[]> = {}
  for (const v of (valueResult.data ?? []) as CharacteristicValue[]) {
    if (!valuesByChar[v.characteristic_id]) valuesByChar[v.characteristic_id] = []
    valuesByChar[v.characteristic_id].push(v)
  }

  return orderedCharIds
    .filter(id => charById[id])
    .map(id => ({ ...charById[id], characteristic_values: valuesByChar[id] ?? [] }))
}

// ─── Product Texts ────────────────────────────────────────────────────────────

export async function fetchProductTexts(productId: string): Promise<ProductText[]> {
  const { data, error } = await supabase
    .from('product_texts')
    .select('*')
    .eq('product_id', productId)
    .in('text_type', ['product', 'specification'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProductText[]
}

export async function fetchAllProductTexts(productId: string): Promise<ProductText[]> {
  const { data, error } = await supabase
    .from('product_texts')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProductText[]
}

export async function fetchGlobalTexts(): Promise<ProductText[]> {
  const { data, error } = await supabase
    .from('product_texts')
    .select('*')
    .is('product_id', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProductText[]
}

export async function createProductText(
  input: Pick<ProductText, 'product_id' | 'label' | 'content' | 'text_type' | 'language' | 'sort_order'>
): Promise<ProductText> {
  const { data, error } = await supabase
    .from('product_texts')
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ProductText
}

export async function updateProductText(
  id: string,
  input: Partial<Pick<ProductText, 'label' | 'content' | 'text_type' | 'language' | 'sort_order'>>
): Promise<ProductText> {
  const { data, error } = await supabase
    .from('product_texts')
    .update(input as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ProductText
}

export async function deleteProductText(id: string): Promise<void> {
  const { error } = await supabase.from('product_texts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
