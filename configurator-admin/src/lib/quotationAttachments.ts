import { supabase } from '@/lib/supabase'
import type { QuotationAttachment } from '@/types/database'

/** Per-email size cap shared between client UI checks and the edge function. */
export const MAX_EMAIL_BYTES = 20 * 1024 * 1024

const BUCKET = 'quotation-attachments'

export async function listAttachments(quotationId: string): Promise<QuotationAttachment[]> {
  const { data, error } = await supabase
    .from('quotation_attachments')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as QuotationAttachment[]
}

export async function uploadAttachment(
  quotationId: string,
  tenantId:    string,
  file:        File,
): Promise<QuotationAttachment> {
  if (file.size <= 0) throw new Error('File is empty')
  if (file.size > MAX_EMAIL_BYTES) {
    throw new Error(`File exceeds the ${Math.floor(MAX_EMAIL_BYTES / 1024 / 1024)} MB cap`)
  }

  // Generate a fresh id and use it as the storage object name so the
  // original filename can have spaces / non-ascii without leaking into
  // the storage path.
  const id   = crypto.randomUUID()
  const path = `${tenantId}/${quotationId}/${id}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert:      false,
      contentType: file.type || 'application/octet-stream',
    })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('quotation_attachments')
    .insert({
      id,
      tenant_id:    tenantId,
      quotation_id: quotationId,
      storage_path: path,
      filename:     file.name,
      mime_type:    file.type || 'application/octet-stream',
      size_bytes:   file.size,
    } as never)
    .select()
    .single()
  if (error) {
    // Roll back the storage upload so we don't leave orphan objects.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw error
  }
  return data as QuotationAttachment
}

export async function deleteAttachment(att: QuotationAttachment): Promise<void> {
  const { error } = await supabase
    .from('quotation_attachments')
    .delete()
    .eq('id', att.id)
  if (error) throw error
  // Remove the storage object after the row is gone; ignore errors so we
  // don't block the UI on a dangling storage object.
  await supabase.storage.from(BUCKET).remove([att.storage_path]).catch(() => {})
}

export function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
