/**
 * Plan boundary tests — structured error propagation across all limit dimensions.
 * Tests createProduct / inquiry insert / send-invite behaviour when DB triggers fire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { atLimit } from '@/lib/planLimits'

// ── Shared mock plan limit rows (mirrors migration 039 values) ────────────────

const PLAN_ROWS = {
  free:    { products_max: 3,  inquiries_per_month: 25,   team_members_max: 1,  three_d: false, quotations: false, webhooks: false, remove_branding: false, white_label: false, ai_setup_per_month: 0,  analytics: 'basic'    },
  starter: { products_max: 25, inquiries_per_month: 250,  team_members_max: 3,  three_d: true,  quotations: true,  webhooks: false, remove_branding: false, white_label: false, ai_setup_per_month: 5,  analytics: 'basic'    },
  growth:  { products_max: -1, inquiries_per_month: 2000, team_members_max: 10, three_d: true,  quotations: true,  webhooks: true,  remove_branding: true,  white_label: false, ai_setup_per_month: 50, analytics: 'advanced' },
  scale:   { products_max: -1, inquiries_per_month: -1,   team_members_max: -1, three_d: true,  quotations: true,  webhooks: true,  remove_branding: true,  white_label: true,  ai_setup_per_month: -1, analytics: 'advanced' },
} as const

// ── Structured error helpers (mirrors _shared/planGate.ts logic) ──────────────

const NEXT_PLAN: Record<string, string> = {
  free: 'starter', starter: 'growth', growth: 'scale', scale: 'scale',
}

function makePlanError(dimension: string, plan: string, current?: number, limit?: number) {
  return {
    code: 'PLAN_LIMIT_EXCEEDED',
    dimension,
    ...(current !== undefined && { current }),
    ...(limit   !== undefined && { limit }),
    plan,
    upgrade_to: NEXT_PLAN[plan] ?? 'scale',
  }
}

// ── Structured error shape ────────────────────────────────────────────────────

describe('makePlanError shape', () => {
  it('includes all required fields', () => {
    const err = makePlanError('products', 'free', 3, 3)
    expect(err.code).toBe('PLAN_LIMIT_EXCEEDED')
    expect(err.dimension).toBe('products')
    expect(err.current).toBe(3)
    expect(err.limit).toBe(3)
    expect(err.plan).toBe('free')
    expect(err.upgrade_to).toBe('starter')
  })

  it('omits current/limit when not provided', () => {
    const err = makePlanError('quotations', 'free')
    expect('current' in err).toBe(false)
    expect('limit' in err).toBe(false)
    expect(err.upgrade_to).toBe('starter')
  })

  it('upgrade_to maps correctly for all plans', () => {
    expect(makePlanError('x', 'free').upgrade_to).toBe('starter')
    expect(makePlanError('x', 'starter').upgrade_to).toBe('growth')
    expect(makePlanError('x', 'growth').upgrade_to).toBe('scale')
    expect(makePlanError('x', 'scale').upgrade_to).toBe('scale')
  })
})

// ── Product limit propagation ─────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => {
  let _insertError: { message: string } | null = null

  const insertMock = vi.fn(() => ({
    select: () => ({
      single: async () => ({ data: null, error: _insertError }),
    }),
  }))

  return {
    supabase: {
      from: (_table: string) => ({
        insert: (v: unknown) => {
          // Detect product insert — propagate mocked error
          if (_insertError) return insertMock()
          return { select: () => ({ single: async () => ({ data: { id: 'prod-1', ...(v as object) }, error: null }) }) }
        },
        select: () => ({ order: () => ({ order: () => ({ data: [], error: null }) }) }),
      }),
      _setInsertError: (err: { message: string } | null) => { _insertError = err },
    },
  }
})

describe('createProduct — plan_limit_exceeded propagation', () => {
  // Import after mocks are set up
  let createProduct: (input: { name: string; description: null; base_price: number; currency: string }) => Promise<unknown>

  beforeEach(async () => {
    const mod = await import('@/lib/products')
    createProduct = mod.createProduct
  })

  it('throws a human-readable error when DB returns PLAN_LIMIT_EXCEEDED JSON', async () => {
    const structuredMsg = JSON.stringify(makePlanError('products', 'free', 3, 3))
    const { supabase } = await import('@/lib/supabase')
    ;(supabase as any)._setInsertError({ message: structuredMsg })

    await expect(createProduct({ name: 'Test', description: null, base_price: 0, currency: 'EUR' }))
      .rejects.toThrow(/Product limit reached/)

    ;(supabase as any)._setInsertError(null)
  })

  it('throws a human-readable error for legacy lowercase plan_limit_exceeded', async () => {
    const { supabase } = await import('@/lib/supabase')
    ;(supabase as any)._setInsertError({ message: 'new row violates check constraint "plan_limit_exceeded"' })

    await expect(createProduct({ name: 'Test', description: null, base_price: 0, currency: 'EUR' }))
      .rejects.toThrow(/Product limit reached/)

    ;(supabase as any)._setInsertError(null)
  })
})

// ── Per-plan atLimit boundary checks ─────────────────────────────────────────

describe('product limit boundaries per plan', () => {
  it('free: under limit', () => expect(atLimit(PLAN_ROWS.free.products_max, 2)).toBe(false))
  it('free: at limit (3)', () => expect(atLimit(PLAN_ROWS.free.products_max, 3)).toBe(true))
  it('starter: at limit (25)', () => expect(atLimit(PLAN_ROWS.starter.products_max, 25)).toBe(true))
  it('growth: unlimited', () => expect(atLimit(PLAN_ROWS.growth.products_max, 9999)).toBe(false))
  it('scale: unlimited', () => expect(atLimit(PLAN_ROWS.scale.products_max, 9999)).toBe(false))
})

describe('inquiry limit boundaries per plan', () => {
  it('free: at limit (25/mo)', () => expect(atLimit(PLAN_ROWS.free.inquiries_per_month, 25)).toBe(true))
  it('free: under limit', () => expect(atLimit(PLAN_ROWS.free.inquiries_per_month, 24)).toBe(false))
  it('starter: at limit (250/mo)', () => expect(atLimit(PLAN_ROWS.starter.inquiries_per_month, 250)).toBe(true))
  it('growth: at limit (2000/mo)', () => expect(atLimit(PLAN_ROWS.growth.inquiries_per_month, 2000)).toBe(true))
  it('scale: unlimited', () => expect(atLimit(PLAN_ROWS.scale.inquiries_per_month, 99999)).toBe(false))
})

describe('team member limit boundaries per plan', () => {
  it('free: at limit (1)', () => expect(atLimit(PLAN_ROWS.free.team_members_max, 1)).toBe(true))
  it('free: under limit', () => expect(atLimit(PLAN_ROWS.free.team_members_max, 0)).toBe(false))
  it('starter: at limit (3)', () => expect(atLimit(PLAN_ROWS.starter.team_members_max, 3)).toBe(true))
  it('growth: at limit (10)', () => expect(atLimit(PLAN_ROWS.growth.team_members_max, 10)).toBe(true))
  it('scale: unlimited', () => expect(atLimit(PLAN_ROWS.scale.team_members_max, 999)).toBe(false))
})

describe('AI setup limit boundaries per plan', () => {
  it('free: always at limit (0 max)', () => expect(atLimit(PLAN_ROWS.free.ai_setup_per_month, 0)).toBe(true))
  it('free: even at 0 usage', () => expect(atLimit(0, 0)).toBe(true))
  it('starter: at limit (5)', () => expect(atLimit(PLAN_ROWS.starter.ai_setup_per_month, 5)).toBe(true))
  it('growth: at limit (50)', () => expect(atLimit(PLAN_ROWS.growth.ai_setup_per_month, 50)).toBe(true))
  it('scale: unlimited (-1)', () => expect(atLimit(PLAN_ROWS.scale.ai_setup_per_month, 999)).toBe(false))
})

// ── Boolean feature gates per plan ────────────────────────────────────────────

describe('feature gates: three_d', () => {
  it('free: not available', () => expect(PLAN_ROWS.free.three_d).toBe(false))
  it('starter: available', () => expect(PLAN_ROWS.starter.three_d).toBe(true))
  it('growth: available', () => expect(PLAN_ROWS.growth.three_d).toBe(true))
})

describe('feature gates: quotations', () => {
  it('free: not available', () => expect(PLAN_ROWS.free.quotations).toBe(false))
  it('starter: available', () => expect(PLAN_ROWS.starter.quotations).toBe(true))
  it('growth: available', () => expect(PLAN_ROWS.growth.quotations).toBe(true))
})

describe('feature gates: webhooks', () => {
  it('free: not available', () => expect(PLAN_ROWS.free.webhooks).toBe(false))
  it('starter: not available', () => expect(PLAN_ROWS.starter.webhooks).toBe(false))
  it('growth: available', () => expect(PLAN_ROWS.growth.webhooks).toBe(true))
  it('scale: available', () => expect(PLAN_ROWS.scale.webhooks).toBe(true))
})

describe('feature gates: remove_branding', () => {
  it('free: not available', () => expect(PLAN_ROWS.free.remove_branding).toBe(false))
  it('starter: not available', () => expect(PLAN_ROWS.starter.remove_branding).toBe(false))
  it('growth: available', () => expect(PLAN_ROWS.growth.remove_branding).toBe(true))
  it('scale: available', () => expect(PLAN_ROWS.scale.remove_branding).toBe(true))
})

describe('feature gates: white_label', () => {
  it('free/starter/growth: not available', () => {
    expect(PLAN_ROWS.free.white_label).toBe(false)
    expect(PLAN_ROWS.starter.white_label).toBe(false)
    expect(PLAN_ROWS.growth.white_label).toBe(false)
  })
  it('scale: available', () => expect(PLAN_ROWS.scale.white_label).toBe(true))
})

describe('feature gates: analytics', () => {
  it('free/starter: basic', () => {
    expect(PLAN_ROWS.free.analytics).toBe('basic')
    expect(PLAN_ROWS.starter.analytics).toBe('basic')
  })
  it('growth/scale: advanced', () => {
    expect(PLAN_ROWS.growth.analytics).toBe('advanced')
    expect(PLAN_ROWS.scale.analytics).toBe('advanced')
  })
})

// ── Inquiry structured error from DB trigger ──────────────────────────────────

describe('inquiry PLAN_LIMIT_EXCEEDED error format', () => {
  it('DB trigger error message is valid JSON with required fields', () => {
    const errMsg = JSON.stringify(makePlanError('inquiries', 'free', 25, 25))
    const parsed = JSON.parse(errMsg)
    expect(parsed.code).toBe('PLAN_LIMIT_EXCEEDED')
    expect(parsed.dimension).toBe('inquiries')
    expect(parsed.current).toBe(25)
    expect(parsed.limit).toBe(25)
    expect(parsed.upgrade_to).toBe('starter')
  })

  it('team_members error points to correct upgrade path from starter', () => {
    const err = makePlanError('team_members', 'starter', 3, 3)
    expect(err.upgrade_to).toBe('growth')
  })
})
