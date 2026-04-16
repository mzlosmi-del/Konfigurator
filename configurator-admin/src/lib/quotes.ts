import { supabase } from './supabase'
import type { Quote } from '@/types/database'

export async function fetchQuotesForInquiry(inquiryId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Quote[]
}

export async function generateAndSendQuote(
  inquiryId: string,
  expiresAt: string | null
): Promise<Quote> {
  const { data, error } = await supabase.functions.invoke('generate-quote', {
    body: { inquiry_id: inquiryId, expires_at: expiresAt },
  })
  if (error) throw new Error(error.message)
  return data as Quote
}
