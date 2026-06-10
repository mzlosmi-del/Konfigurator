/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase'
import type { VisualizationAsset } from '@/types/database'

async function getTenantId(): Promise<string> {
  const { data, error } = await supabase.rpc('auth_tenant_id' as any)
  if (error || !data) throw new Error('Could not resolve tenant')
  return data as string
}

export const PRODUCT_ASSETS_BUCKET = 'product-assets'
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${PRODUCT_ASSETS_BUCKET}/`

/**
 * If `url` is a Supabase public URL into our own `product-assets` bucket,
 * return the bucket-relative storage path (`{tenantId}/{productId}/{file}`).
 * Returns null for external / pasted URLs and URLs for any other bucket —
 * those files are not ours to delete.
 */
export function storagePathForAssetUrl(url: string): string | null {
  if (!url) return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const path = url.slice(idx + PUBLIC_URL_MARKER.length).split('?')[0]
  return path.length > 0 ? path : null
}

export async function fetchAssetsForProduct(productId: string): Promise<VisualizationAsset[]> {
  const { data, error } = await supabase
    .from('visualization_assets')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as VisualizationAsset[]
}

/** Fetch every `asset_type = 'image'` row for a list of products in a single
 *  query. Used by the Technical Specification Word builder to embed product
 *  and characteristic-value images. */
export async function fetchImageAssetsForProducts(productIds: string[]): Promise<VisualizationAsset[]> {
  if (productIds.length === 0) return []
  const { data, error } = await supabase
    .from('visualization_assets')
    .select('*')
    .in('product_id', productIds)
    .eq('asset_type', 'image')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as VisualizationAsset[]
}

export async function createAsset(
  input: Pick<
    VisualizationAsset,
    'product_id' | 'characteristic_value_id' | 'asset_type' | 'url' | 'is_default' | 'sort_order'
  >
): Promise<VisualizationAsset> {
  const tenant_id = await getTenantId()
  const { data, error } = await supabase
    .from('visualization_assets')
    .insert({ ...input, tenant_id } as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as VisualizationAsset
}

export async function updateAsset(
  id: string,
  input: Partial<
    Pick<VisualizationAsset, 'characteristic_value_id' | 'asset_type' | 'url' | 'is_default' | 'sort_order' | 'mesh_rules'>
  >
): Promise<VisualizationAsset> {
  const { data, error } = await supabase
    .from('visualization_assets')
    .update(input as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as VisualizationAsset
}

export async function deleteAsset(id: string): Promise<void> {
  // Look up the URL first so we know whether a hosted file needs cleanup.
  // The select error is intentionally ignored — cleanup is best-effort; a failed
  // lookup just skips storage removal and the DB delete still proceeds.
  const { data: row } = await supabase
    .from('visualization_assets')
    .select('url')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('visualization_assets')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)

  // Best-effort storage cleanup — only for files we host; never block the delete.
  const assetRow = row as { url: string } | null
  const path = assetRow?.url ? storagePathForAssetUrl(assetRow.url) : null
  if (path) {
    await supabase.storage.from(PRODUCT_ASSETS_BUCKET).remove([path]).catch(() => {})
  }
}

// Reorder: apply new sort_order values in a batch
export async function reorderAssets(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase
        .from('visualization_assets')
        .update({ sort_order } as unknown as never)
        .eq('id', id)
    )
  )
}

// Upload a file to Supabase Storage under the tenant's folder.
// Returns the public URL of the uploaded file.
export async function uploadAssetFile(
  tenantId: string,
  productId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${tenantId}/${productId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_ASSETS_BUCKET)
    .upload(path, file, { upsert: false })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from(PRODUCT_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ── Visualization assignment table (migration 095) ──────────────────────────

export interface AssignmentConditionInput {
  characteristic_id: string
  operator: 'eq' | 'gt' | 'lt'
  value_id: string | null
  numeric_value: number | null
}

export interface AssignmentRow {
  id: string
  asset_id: string
  priority: number
  conditions: AssignmentConditionInput[]
}

export async function fetchAssignments(productId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('visualization_assignments')
    .select('id, asset_id, priority, visualization_assignment_conditions (characteristic_id, operator, value_id, numeric_value)')
    .eq('product_id', productId)
    .order('priority', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map(a => ({
    id: a.id,
    asset_id: a.asset_id,
    priority: a.priority,
    conditions: ((a.visualization_assignment_conditions ?? []) as any[]).map(c => ({
      characteristic_id: c.characteristic_id,
      operator: c.operator,
      value_id: c.value_id ?? null,
      numeric_value: c.numeric_value === null || c.numeric_value === undefined ? null : Number(c.numeric_value),
    })),
  }))
}

/** Insert or update one assignment row and replace its conditions wholesale.
 *  Pass `id: null` to create. Returns the row id. */
export async function saveAssignment(
  productId: string,
  row: { id: string | null; asset_id: string; priority: number; conditions: AssignmentConditionInput[] },
): Promise<string> {
  const tenant_id = await getTenantId()

  let assignmentId = row.id
  if (assignmentId) {
    const { error } = await supabase
      .from('visualization_assignments')
      .update({ asset_id: row.asset_id, priority: row.priority } as unknown as never)
      .eq('id', assignmentId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase
      .from('visualization_assignments')
      .insert({ tenant_id, product_id: productId, asset_id: row.asset_id, priority: row.priority } as any)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    assignmentId = (data as { id: string }).id
  }

  // Replace conditions: delete existing, reinsert current set.
  const { error: delError } = await supabase
    .from('visualization_assignment_conditions')
    .delete()
    .eq('assignment_id', assignmentId)
  if (delError) throw new Error(delError.message)

  if (row.conditions.length > 0) {
    const { error: insError } = await supabase
      .from('visualization_assignment_conditions')
      .insert(row.conditions.map(c => ({
        tenant_id,
        assignment_id: assignmentId,
        characteristic_id: c.characteristic_id,
        operator: c.operator,
        value_id: c.value_id,
        numeric_value: c.numeric_value,
      })) as any)
    if (insError) throw new Error(insError.message)
  }

  return assignmentId as string
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('visualization_assignments')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
