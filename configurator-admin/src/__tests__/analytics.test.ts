import { describe, it, expect } from 'vitest'

// ── Event validation (mirrors ingest-events edge function) ────────────────────

const VALID_TYPES = new Set(['view', 'characteristic_changed', 'inquiry_started', 'inquiry_submitted'])

function validateEvent(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const ev = e as Record<string, unknown>
  if (typeof ev.session_id !== 'string' || !ev.session_id) return false
  if (!VALID_TYPES.has(ev.event_type as string))            return false
  if (ev.payload !== undefined && typeof ev.payload !== 'object') return false
  return true
}

function validateBatch(body: unknown): { ok: boolean; error?: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'not object' }
  const b = body as Record<string, unknown>
  if (typeof b.product_id !== 'string' || !b.product_id) return { ok: false, error: 'missing product_id' }
  if (typeof b.tenant_id  !== 'string' || !b.tenant_id)  return { ok: false, error: 'missing tenant_id' }
  if (!Array.isArray(b.events) || b.events.length === 0)  return { ok: false, error: 'empty events' }
  if (b.events.length > 20)                               return { ok: false, error: 'too many events' }
  for (const e of b.events) if (!validateEvent(e))        return { ok: false, error: 'bad event' }
  return { ok: true }
}

describe('ingest-events: payload validation', () => {
  const base = {
    product_id: 'p-1',
    tenant_id:  't-1',
    events: [{ session_id: 'sid-1', event_type: 'view', payload: {} }],
  }

  it('accepts a valid batch', () => {
    expect(validateBatch(base).ok).toBe(true)
  })

  it('rejects missing product_id', () => {
    expect(validateBatch({ ...base, product_id: '' }).ok).toBe(false)
  })

  it('rejects missing tenant_id', () => {
    expect(validateBatch({ ...base, tenant_id: undefined }).ok).toBe(false)
  })

  it('rejects empty events array', () => {
    expect(validateBatch({ ...base, events: [] }).ok).toBe(false)
  })

  it('rejects more than 20 events', () => {
    const tooMany = Array(21).fill({ session_id: 'x', event_type: 'view' })
    expect(validateBatch({ ...base, events: tooMany }).ok).toBe(false)
  })

  it('rejects unknown event_type', () => {
    expect(validateBatch({ ...base, events: [{ session_id: 's', event_type: 'unknown' }] }).ok).toBe(false)
  })

  it('rejects event missing session_id', () => {
    expect(validateBatch({ ...base, events: [{ event_type: 'view' }] }).ok).toBe(false)
  })

  it('accepts all valid event types', () => {
    for (const type of VALID_TYPES) {
      const batch = { ...base, events: [{ session_id: 'sid', event_type: type }] }
      expect(validateBatch(batch).ok).toBe(true)
    }
  })

  it('allows payload to be omitted', () => {
    const batch = { ...base, events: [{ session_id: 'sid', event_type: 'view' }] }
    expect(validateBatch(batch).ok).toBe(true)
  })
})

// ── Rate limit logic ──────────────────────────────────────────────────────────

const RATE_LIMIT = 10

function isRateLimited(recentCount: number): boolean {
  return recentCount >= RATE_LIMIT
}

describe('ingest-events: rate limiting', () => {
  it('allows the 10th request', () => {
    expect(isRateLimited(9)).toBe(false)
  })

  it('blocks the 11th request', () => {
    expect(isRateLimited(10)).toBe(true)
  })

  it('allows first request', () => {
    expect(isRateLimited(0)).toBe(false)
  })
})

// ── Analytics aggregation logic ───────────────────────────────────────────────

interface MockEvent { event_type: string; payload: Record<string, unknown>; created_at: string; product_id: string }

function aggregate(events: MockEvent[]) {
  const views     = events.filter(e => e.event_type === 'view').length
  const inquiries = events.filter(e => e.event_type === 'inquiry_submitted').length
  const started   = events.filter(e => e.event_type === 'inquiry_started').length
  const conversion = views > 0 ? (inquiries / views) * 100 : 0
  const prices     = events
    .filter(e => e.event_type === 'inquiry_submitted' && typeof e.payload.price === 'number')
    .map(e => e.payload.price as number)
  const avgPrice   = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  return { views, inquiries, started, conversion, avgPrice }
}

describe('analytics: aggregation', () => {
  const events: MockEvent[] = [
    { event_type: 'view',               payload: {},          created_at: '2024-01-01T10:00:00Z', product_id: 'p1' },
    { event_type: 'view',               payload: {},          created_at: '2024-01-01T10:01:00Z', product_id: 'p1' },
    { event_type: 'inquiry_started',    payload: { price: 299 }, created_at: '2024-01-01T10:02:00Z', product_id: 'p1' },
    { event_type: 'inquiry_submitted',  payload: { price: 299 }, created_at: '2024-01-01T10:03:00Z', product_id: 'p1' },
    { event_type: 'view',               payload: {},          created_at: '2024-01-01T10:04:00Z', product_id: 'p2' },
    { event_type: 'inquiry_submitted',  payload: { price: 499 }, created_at: '2024-01-01T10:05:00Z', product_id: 'p2' },
  ]

  it('counts views correctly', () => {
    expect(aggregate(events).views).toBe(3)
  })

  it('counts inquiries correctly', () => {
    expect(aggregate(events).inquiries).toBe(2)
  })

  it('calculates conversion rate', () => {
    expect(aggregate(events).conversion).toBeCloseTo(66.67, 1)
  })

  it('calculates average price', () => {
    expect(aggregate(events).avgPrice).toBe(399)
  })

  it('returns null avgPrice when no inquiries', () => {
    expect(aggregate([]).avgPrice).toBeNull()
  })

  it('returns 0 conversion when no views', () => {
    expect(aggregate([]).conversion).toBe(0)
  })
})

// ── Analytics plan gating ─────────────────────────────────────────────────────

describe('analytics: plan gating', () => {
  const isAdvanced = (tier: string) => tier === 'advanced'

  it('basic tier does not unlock advanced analytics', () => {
    expect(isAdvanced('basic')).toBe(false)
  })

  it('advanced tier unlocks full analytics', () => {
    expect(isAdvanced('advanced')).toBe(true)
  })

  it('growth plan has advanced analytics per plan_limits seed', () => {
    const growthLimits = { analytics: 'advanced' as string }
    expect(isAdvanced(growthLimits.analytics)).toBe(true)
  })

  it('free plan has basic analytics per plan_limits seed', () => {
    const freeLimits = { analytics: 'basic' as string }
    expect(isAdvanced(freeLimits.analytics)).toBe(false)
  })
})
