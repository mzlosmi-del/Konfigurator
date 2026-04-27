/**
 * Shared plan-gate utilities for edge functions.
 * Each gated function loads limits once, then calls assertFeature / assertMonthlyLimit.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface PlanLimits {
  plan:                string
  products_max:        number
  inquiries_per_month: number
  team_members_max:    number
  three_d:             boolean
  quotations:          boolean
  webhooks:            boolean
  remove_branding:     boolean
  white_label:         boolean
  ai_setup_per_month:  number
  analytics:           string
}

export interface PlanLimitError {
  code:       'PLAN_LIMIT_EXCEEDED'
  dimension:  string
  current?:   number
  limit?:     number
  plan:       string
  upgrade_to: string
}

const NEXT_PLAN: Record<string, string> = {
  free: 'starter', starter: 'growth', growth: 'scale', scale: 'scale',
}

export function makePlanError(
  dimension: string,
  plan: string,
  current?: number,
  limit?: number,
): PlanLimitError {
  return {
    code: 'PLAN_LIMIT_EXCEEDED',
    dimension,
    ...(current !== undefined && { current }),
    ...(limit   !== undefined && { limit }),
    plan,
    upgrade_to: NEXT_PLAN[plan] ?? 'scale',
  }
}

/** Load plan limits for a tenant in one DB round-trip. */
export async function loadPlanLimits(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<PlanLimits | null> {
  const { data } = await sb
    .from('tenants')
    .select('plan, plan_limits!inner(*)')
    .eq('id', tenantId)
    .single()
  if (!data) return null
  const row = (data as Record<string, unknown>)
  const limits = (row.plan_limits as PlanLimits[] | PlanLimits | null)
  if (!limits) return null
  return Array.isArray(limits) ? limits[0] : limits
}

/**
 * Throw a 403 Response if the plan doesn't include this boolean feature.
 * Call with the limits object and the feature key.
 */
export function assertFeature(
  feature: keyof Pick<PlanLimits, 'three_d' | 'quotations' | 'webhooks' | 'white_label'>,
  limits: PlanLimits,
): void {
  if (!limits[feature]) {
    throw gateForbidden(makePlanError(feature, limits.plan))
  }
}

/** Throw a 403 Response if the monthly usage has hit the limit. */
export function assertMonthlyLimit(
  dimension: 'ai_setup' | 'inquiries',
  limitValue: number,
  current: number,
  plan: string,
): void {
  if (limitValue < 0) return  // -1 = unlimited
  if (current >= limitValue) {
    throw gateForbidden(makePlanError(dimension, plan, current, limitValue))
  }
}

/** Build a 403 Response carrying the structured error JSON. */
export function gateForbidden(err: PlanLimitError, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(err), {
    status:  403,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
