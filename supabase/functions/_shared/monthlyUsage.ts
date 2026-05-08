/**
 * Shared helpers for monthly usage tracking. Single source of truth for the
 * period-month computation and the get/increment shape used by gated Edge
 * Functions (e.g. ai-product-setup).
 *
 * Inquiries are tracked automatically via DB trigger (migration 029); this
 * module is intended for dimensions that the application increments
 * explicitly.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type MonthlyUsageDimension = 'inquiries' | 'ai_setup'

/** First day of the current calendar month, ISO date (YYYY-MM-DD). */
export function currentPeriodMonth(): string {
  const d = new Date()
  d.setUTCDate(1)
  return d.toISOString().slice(0, 10)
}

/** Read the current count for `dimension`. Returns 0 when no row exists. */
export async function getMonthlyUsage(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  dimension: MonthlyUsageDimension,
): Promise<number> {
  const column = dimension === 'inquiries' ? 'inquiries_count' : 'ai_setup_count'
  const { data } = await sb
    .from('monthly_usage')
    .select(column)
    .eq('tenant_id', tenantId)
    .eq('period_month', currentPeriodMonth())
    .maybeSingle()
  if (!data) return 0
  return ((data as Record<string, number>)[column] ?? 0)
}

/**
 * Atomically add 1 to the dimension counter for the current period. Uses
 * upsert so the first call of the month creates the row.
 */
export async function incrementMonthlyUsage(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  dimension: MonthlyUsageDimension,
): Promise<void> {
  const period = currentPeriodMonth()
  const current = await getMonthlyUsage(sb, tenantId, dimension)
  const row: Record<string, unknown> = {
    tenant_id:    tenantId,
    period_month: period,
    inquiries_count: dimension === 'inquiries' ? current + 1 : 0,
    ai_setup_count:  dimension === 'ai_setup'  ? current + 1 : 0,
  }
  // Preserve the other dimension's count if a row already exists.
  if (current > 0 || dimension === 'ai_setup') {
    const { data: existing } = await sb
      .from('monthly_usage')
      .select('inquiries_count, ai_setup_count')
      .eq('tenant_id', tenantId)
      .eq('period_month', period)
      .maybeSingle()
    if (existing) {
      const ex = existing as { inquiries_count: number; ai_setup_count: number }
      row.inquiries_count = dimension === 'inquiries' ? ex.inquiries_count + 1 : ex.inquiries_count
      row.ai_setup_count  = dimension === 'ai_setup'  ? ex.ai_setup_count  + 1 : ex.ai_setup_count
    }
  }
  await sb.from('monthly_usage').upsert(row as never, { onConflict: 'tenant_id,period_month' })
}
