/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase'
import type { VisualizationAsset } from '@/types/database'

async function getTenantId(): Promise<string> {
  const { data, error } = await supabase.rpc('auth_tenant_id' as any)
  if (error || !data) throw new Error('Could not resolve tenant')
  return data as string
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
    Pick<VisualizationAsset, 'characteristic_value_id' | 'asset_type' | 'url' | 'is_default' | 'sort_order'>
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
  const { error } = await supabase
    .from('visualization_assets')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
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
    .from('product-assets')
    .upload(path, file, { upsert: false })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from('product-assets').getPublicUrl(path)
  return data.publicUrl
}
