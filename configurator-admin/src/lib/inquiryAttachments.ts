import { supabase } from '@/lib/supabase'
import type { InquiryAttachment } from '@/types/database'

const BUCKET = 'inquiry-attachments'

/** List a customer's uploaded attachments for one inquiry, oldest first. */
export async function listInquiryAttachments(inquiryId: string): Promise<InquiryAttachment[]> {
  const { data, error } = await supabase
    .from('inquiry_attachments')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as InquiryAttachment[]
}

/** Create a short-lived signed download URL for a private attachment. */
export async function getInquiryAttachmentUrl(att: InquiryAttachment): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(att.storage_path, 60 * 5) // 5 minutes
  if (error || !data?.signedUrl) throw error ?? new Error('Could not sign URL')
  return data.signedUrl
}

export function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
