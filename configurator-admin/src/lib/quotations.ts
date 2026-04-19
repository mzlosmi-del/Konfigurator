import { supabase } from './supabase'
import type { Quotation, QuotationLineItem, QuotationAdjustment } from '@/types/database'

export async function fetchQuotations(): Promise<Quotation[]> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Quotation[]
}

export async function fetchQuotation(id: string): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as Quotation
}

export async function createQuotation(
  input: Omit<Quotation, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(input as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Quotation
}

export async function updateQuotation(
  id: string,
  input: Partial<Omit<Quotation, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    .update(input as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Quotation
}

export async function generateQuotationPdf(id: string): Promise<{ pdf_url: string }> {
  const { data, error } = await supabase.functions.invoke('generate-quotation', {
    body: { quotation_id: id },
  })
  if (error) throw new Error(error.message)
  return data as { pdf_url: string }
}

export async function uploadQuotationPdf(
  quotationId: string,
  tenantId: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = `${tenantId}/quotations/${quotationId}.pdf`
  const { error } = await supabase.storage
    .from('quotes')
    .upload(path, bytes.buffer as ArrayBuffer, { upsert: true, contentType: 'application/pdf' })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('quotes').getPublicUrl(path)
  const url = data.publicUrl
  await updateQuotation(quotationId, { pdf_url: url })
  return url
}

export function calcSubtotal(items: QuotationLineItem[]): number {
  return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
}

export function calcTotal(subtotal: number, adjustments: QuotationAdjustment[]): number {
  let running = subtotal
  for (const adj of adjustments) {
    const amount = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
    if (adj.type === 'discount') {
      running -= amount
    } else {
      running += amount
    }
  }
  return Math.max(0, running)
}

export function generateReferenceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `QT-${date}-${suffix}`
}
