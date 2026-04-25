import { supabase } from '@/lib/supabase'

export type Plan = 'free' | 'starter' | 'growth' | 'scale'

export interface PlanLimits {
  plan:                 Plan
  products_max:         number   // -1 = unlimited
  inquiries_per_month:  number
  team_members_max:     number
  three_d:              boolean
  quotations:           boolean
  webhooks:             boolean
  remove_branding:      boolean
  white_label:          boolean
  ai_setup_per_month:   number
  analytics:            'basic' | 'advanced'
}

export async function fetchPlanLimits(plan: string): Promise<PlanLimits> {
  const { data, error } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', plan)
    .single()
  if (error || !data) return FREE_FALLBACK
  return data as PlanLimits
}

/** True if the given count is at or over the dimension's max (-1 = unlimited). */
export function atLimit(max: number, count: number): boolean {
  return max >= 0 && count >= max
}

export function isUnlimited(max: number): boolean {
  return max < 0
}

export function planLabel(plan: string): string {
  const labels: Record<string, string> = {
    free:    'Free',
    starter: 'Starter',
    growth:  'Growth',
    scale:   'Scale',
  }
  return labels[plan] ?? plan
}

/** "∞" for unlimited, else the number as string. */
export function limitDisplay(max: number): string {
  return max < 0 ? '∞' : String(max)
}

// ── Backwards-compat shims (used by ProductsPage / SettingsPage) ──────────────

export function productLimit(_plan: string): number {
  return FREE_FALLBACK.products_max  // overridden once planLimits loads from context
}

export function atProductLimit(_plan: string, _count: number): boolean {
  return false  // overridden once planLimits loads from context
}

// ─────────────────────────────────────────────────────────────────────────────

const FREE_FALLBACK: PlanLimits = {
  plan:                'free',
  products_max:         3,
  inquiries_per_month:  25,
  team_members_max:     1,
  three_d:              false,
  quotations:           false,
  webhooks:             false,
  remove_branding:      false,
  white_label:          false,
  ai_setup_per_month:   0,
  analytics:            'basic',
}
