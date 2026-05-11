/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase'
import { t } from '@/i18n'
import type { Inquiry, InquiryStatus } from '@/types/database'

/** Compact relative-time helper: "just now", "5m ago", "2h ago", "3d ago", or absolute date past 30d. */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return t('just now')
  if (mins < 60) return `${mins}${t('m ago')}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}${t('h ago')}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}${t('d ago')}`
  return new Date(dateStr).toLocaleDateString()
}

export async function fetchInquiries(status?: InquiryStatus | 'all'): Promise<Inquiry[]> {
  let query = supabase
    .from('inquiries')
    .select('*, product:products(name)')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
}

export async function fetchInquiry(id: string): Promise<Inquiry & { product: { name: string } }> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*, product:products(name)')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as any
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<Inquiry> {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status } as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Inquiry
}

export async function countNewInquiries(): Promise<number> {
  const { count, error } = await supabase
    .from('inquiries')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')
  if (error) return 0
  return count ?? 0
}
