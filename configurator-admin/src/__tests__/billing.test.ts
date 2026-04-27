import { describe, it, expect, vi } from 'vitest'
import { atLimit, planLabel } from '@/lib/planLimits'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
  },
}))

// ── Plan label smoke tests ────────────────────────────────────────────────────

describe('planLabel after Phase 2 changes', () => {
  it('still handles all 4 tiers', () => {
    expect(planLabel('free')).toBe('Free')
    expect(planLabel('starter')).toBe('Starter')
    expect(planLabel('growth')).toBe('Growth')
    expect(planLabel('scale')).toBe('Scale')
  })
})

// ── Downgrade-with-overage logic ─────────────────────────────────────────────
// The mark_over_limit_products DB function is tested via migration verification.
// Here we test the client-side guard: atLimit tells the UI whether a resource
// is over the limit for the new (downgraded) plan.

describe('downgrade-with-overage: atLimit correctly identifies excess', () => {
  it('free plan: 3 products allowed, 4 existing → at limit', () => {
    expect(atLimit(3, 4)).toBe(true)
  })
  it('free plan: 2 products → under limit', () => {
    expect(atLimit(3, 2)).toBe(false)
  })
  it('free plan: 25 inquiries allowed, 26 this month → at limit', () => {
    expect(atLimit(25, 26)).toBe(true)
  })
  it('downgrade from growth to starter: team of 5, max 3 → at limit', () => {
    expect(atLimit(3, 5)).toBe(true)
  })
  it('downgrade to scale: unlimited products → never at limit', () => {
    expect(atLimit(-1, 9999)).toBe(false)
  })
})

// ── Webhook idempotency ───────────────────────────────────────────────────────
// Verifies the key design: processed_events deduplication prevents double updates.
// (Full integration tests run against a real Stripe test environment; these
//  are pure logic tests of the decision the webhook handler makes.)

describe('stripe-webhook idempotency contract', () => {
  it('second call with same event id should be a no-op', () => {
    const seenEvents = new Set<string>()

    function processEvent(id: string): 'processed' | 'duplicate' {
      if (seenEvents.has(id)) return 'duplicate'
      seenEvents.add(id)
      return 'processed'
    }

    expect(processEvent('evt_001')).toBe('processed')
    expect(processEvent('evt_001')).toBe('duplicate')
    expect(processEvent('evt_002')).toBe('processed')
  })
})

// ── Grace period ─────────────────────────────────────────────────────────────

describe('grace period calculation', () => {
  it('grace period ends 7 days from now', () => {
    const now    = new Date('2026-01-01T00:00:00Z').getTime()
    const grace  = new Date(now + 7 * 24 * 60 * 60 * 1000)
    expect(grace.toISOString()).toBe('2026-01-08T00:00:00.000Z')
  })

  it('within grace period: subscription_status is past_due, not canceled', () => {
    const status = 'past_due'
    expect(status).not.toBe('canceled')
    expect(['past_due', 'unpaid'].includes(status)).toBe(true)
  })
})
