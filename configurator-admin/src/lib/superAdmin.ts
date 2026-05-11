import { supabase } from '@/lib/supabase'
import type { Plan } from '@/lib/planLimits'

export const SUPER_ADMIN_EMAIL = 'sales@configureout.com'

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL
}

export interface TenantOverviewRow {
  id:                     string
  name:                   string
  slug:                   string | null
  plan:                   Plan
  paid_until:             string | null
  current_period_end:     string | null
  cancel_at_period_end:   boolean
  subscription_status:    string | null
  stripe_customer_id:     string | null
  stripe_subscription_id: string | null
  created_at:             string
  admin_email:            string | null
  products_count:         number
  members_count:          number
  inquiries_this_month:   number
  ai_setup_this_month:    number
}

export async function fetchTenantOverview(): Promise<TenantOverviewRow[]> {
  const { data, error } = await supabase.rpc('admin_tenant_overview' as never)
  if (error) throw error
  return (data ?? []) as TenantOverviewRow[]
}

export async function setTenantPlan(
  tenantId: string,
  plan: Plan,
  paidUntil: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_tenant_plan' as never, {
    p_tenant_id:  tenantId,
    p_plan:       plan,
    p_paid_until: paidUntil,
  } as never)
  if (error) throw error
}

/** Day offset between two ISO timestamps; positive = future, negative = past. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/** Add a number of days to an ISO timestamp (or now if null). Returns ISO string. */
export function shiftDays(iso: string | null, days: number): string {
  const base = iso ? new Date(iso) : new Date()
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString()
}

/** ISO timestamp ↔ "YYYY-MM-DD" for <input type="date">. Uses UTC date parts. */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function dateInputToIso(value: string): string | null {
  if (!value) return null
  // Treat as end-of-day UTC so a date picked today still counts as "today is paid".
  return new Date(`${value}T23:59:59.000Z`).toISOString()
}
