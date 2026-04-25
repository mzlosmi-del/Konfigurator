import { describe, it, expect, vi } from 'vitest'
import { atLimit, isUnlimited, limitDisplay, planLabel, fetchPlanLimits } from '@/lib/planLimits'
import type { PlanLimits } from '@/lib/planLimits'

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('atLimit', () => {
  it('returns false when unlimited (-1)', () => {
    expect(atLimit(-1, 999)).toBe(false)
  })
  it('returns false when under limit', () => {
    expect(atLimit(3, 2)).toBe(false)
  })
  it('returns true when exactly at limit', () => {
    expect(atLimit(3, 3)).toBe(true)
  })
  it('returns true when over limit', () => {
    expect(atLimit(3, 5)).toBe(true)
  })
})

describe('isUnlimited', () => {
  it('returns true for -1', () => expect(isUnlimited(-1)).toBe(true))
  it('returns false for 0', () => expect(isUnlimited(0)).toBe(false))
  it('returns false for positive', () => expect(isUnlimited(25)).toBe(false))
})

describe('limitDisplay', () => {
  it('shows ∞ for -1', () => expect(limitDisplay(-1)).toBe('∞'))
  it('shows number as string', () => expect(limitDisplay(25)).toBe('25'))
  it('shows 0 for 0', () => expect(limitDisplay(0)).toBe('0'))
})

describe('planLabel', () => {
  it('maps all four tiers', () => {
    expect(planLabel('free')).toBe('Free')
    expect(planLabel('starter')).toBe('Starter')
    expect(planLabel('growth')).toBe('Growth')
    expect(planLabel('scale')).toBe('Scale')
  })
  it('returns raw string for unknown plan', () => {
    expect(planLabel('enterprise')).toBe('enterprise')
  })
})

// ── fetchPlanLimits ───────────────────────────────────────────────────────────

const mockLimits: Record<string, PlanLimits> = {
  free: {
    plan: 'free', products_max: 3, inquiries_per_month: 25, team_members_max: 1,
    three_d: false, quotations: false, webhooks: false,
    remove_branding: false, white_label: false, ai_setup_per_month: 0, analytics: 'basic',
  },
  starter: {
    plan: 'starter', products_max: 25, inquiries_per_month: 250, team_members_max: 3,
    three_d: true, quotations: true, webhooks: false,
    remove_branding: false, white_label: false, ai_setup_per_month: 5, analytics: 'basic',
  },
  growth: {
    plan: 'growth', products_max: -1, inquiries_per_month: 2000, team_members_max: 10,
    three_d: true, quotations: true, webhooks: true,
    remove_branding: true, white_label: false, ai_setup_per_month: 50, analytics: 'advanced',
  },
  scale: {
    plan: 'scale', products_max: -1, inquiries_per_month: -1, team_members_max: -1,
    three_d: true, quotations: true, webhooks: true,
    remove_branding: true, white_label: true, ai_setup_per_month: -1, analytics: 'advanced',
  },
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, plan: string) => ({
          single: async () => {
            const data = table === 'plan_limits' ? mockLimits[plan] ?? null : null
            return { data, error: data ? null : { message: 'not found' } }
          },
        }),
      }),
    }),
  },
}))

describe('fetchPlanLimits', () => {
  it('returns correct limits for free', async () => {
    const lim = await fetchPlanLimits('free')
    expect(lim.products_max).toBe(3)
    expect(lim.inquiries_per_month).toBe(25)
    expect(lim.three_d).toBe(false)
    expect(lim.analytics).toBe('basic')
  })

  it('returns correct limits for growth', async () => {
    const lim = await fetchPlanLimits('growth')
    expect(lim.products_max).toBe(-1)
    expect(isUnlimited(lim.products_max)).toBe(true)
    expect(lim.webhooks).toBe(true)
    expect(lim.remove_branding).toBe(true)
    expect(lim.analytics).toBe('advanced')
  })

  it('returns correct limits for scale (all unlimited)', async () => {
    const lim = await fetchPlanLimits('scale')
    expect(isUnlimited(lim.inquiries_per_month)).toBe(true)
    expect(isUnlimited(lim.team_members_max)).toBe(true)
    expect(lim.white_label).toBe(true)
  })

  it('falls back to free limits on DB error', async () => {
    const lim = await fetchPlanLimits('unknown_plan')
    expect(lim.plan).toBe('free')
    expect(lim.products_max).toBe(3)
  })
})

// ── Boundary tests — each limit dimension ────────────────────────────────────

describe('plan boundary: products', () => {
  it('free: at limit at 3', () => expect(atLimit(3, 3)).toBe(true))
  it('free: under limit at 2', () => expect(atLimit(3, 2)).toBe(false))
  it('starter: at limit at 25', () => expect(atLimit(25, 25)).toBe(true))
  it('growth: unlimited, never at limit', () => expect(atLimit(-1, 9999)).toBe(false))
})

describe('plan boundary: inquiries/month', () => {
  it('free: at limit at 25', () => expect(atLimit(25, 25)).toBe(true))
  it('starter: at limit at 250', () => expect(atLimit(250, 250)).toBe(true))
  it('growth: at limit at 2000', () => expect(atLimit(2000, 2000)).toBe(true))
  it('scale: unlimited', () => expect(atLimit(-1, 10000)).toBe(false))
})

describe('plan boundary: team members', () => {
  it('free: at limit at 1', () => expect(atLimit(1, 1)).toBe(true))
  it('starter: at limit at 3', () => expect(atLimit(3, 3)).toBe(true))
  it('growth: at limit at 10', () => expect(atLimit(10, 10)).toBe(true))
  it('scale: unlimited', () => expect(atLimit(-1, 500)).toBe(false))
})

describe('plan boundary: ai_setup/month', () => {
  it('free: always at limit (0)', () => expect(atLimit(0, 0)).toBe(true))
  it('starter: at limit at 5', () => expect(atLimit(5, 5)).toBe(true))
  it('growth: at limit at 50', () => expect(atLimit(50, 50)).toBe(true))
  it('scale: unlimited', () => expect(atLimit(-1, 999)).toBe(false))
})
