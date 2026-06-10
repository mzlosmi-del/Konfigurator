import type { SupabaseClient } from '@supabase/supabase-js'
import { t } from './i18n'

/** Per-file size cap. Mirrors the size_bytes CHECK in migration 093. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024
/** How many files a customer may attach to one inquiry. */
export const MAX_FILES = 3

/** Standard image MIME types accepted by the widget. HEIC/HEIF cover photos
 *  taken on iPhones. Kept in sync with the `accept` attribute on the input
 *  and the customer-facing "Allowed formats" hint. */
export const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]

const BUCKET = 'inquiry-attachments'

/** Validate a candidate list of files for count, per-file size, and type.
 *  Returns a localized error message, or null when everything is valid. */
export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return t('You can attach up to 3 files.')
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return t('Each file must be 20 MB or smaller.')
    // Some browsers report an empty type for HEIC — fall back to the extension.
    const okType = ALLOWED_MIME.includes(f.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name)
    if (!okType) return t('Only image files are allowed (JPG, PNG, GIF, WebP, HEIC).')
  }
  return null
}

/** Upload each file to the inquiry-attachments bucket and record a metadata
 *  row. The inquiry id is generated client-side (the anon RLS policy has no
 *  SELECT, so we can't read it back). On a row-insert failure the just-uploaded
 *  storage object is rolled back. Throws on the first failure. */
export async function uploadInquiryFiles(
  sb: SupabaseClient,
  tenantId: string,
  inquiryId: string,
  files: File[],
): Promise<void> {
  for (const file of files) {
    if (file.size <= 0) continue
    const id   = crypto.randomUUID()
    const path = `${tenantId}/${inquiryId}/${id}`

    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, file, {
        upsert:      false,
        contentType: file.type || 'application/octet-stream',
      })
    if (upErr) throw upErr

    const { error: rowErr } = await sb
      .from('inquiry_attachments')
      .insert({
        id,
        tenant_id:    tenantId,
        inquiry_id:   inquiryId,
        storage_path: path,
        filename:     file.name,
        mime_type:    file.type || 'application/octet-stream',
        size_bytes:   file.size,
      } as never)
    if (rowErr) {
      // Roll back the orphaned storage object before surfacing the error.
      await sb.storage.from(BUCKET).remove([path]).catch(() => {})
      throw rowErr
    }
  }
}

export function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
