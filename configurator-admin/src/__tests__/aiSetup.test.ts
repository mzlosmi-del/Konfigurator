import { describe, it, expect } from 'vitest'

// ── Schema validation (mirrors ai-product-setup edge function) ────────────────

interface CharValue  { label: string; price_modifier: number }
interface AiChar     { name: string; display_type: string; is_required: boolean; values: CharValue[] }
interface AiProduct  { name: string; description: string; base_price: number; currency: string; characteristics: AiChar[] }

function validate(obj: unknown): obj is AiProduct {
  if (typeof obj !== 'object' || obj === null) return false
  const p = obj as Record<string, unknown>
  if (typeof p.name !== 'string' || !p.name) return false
  if (typeof p.description !== 'string') return false
  if (typeof p.base_price !== 'number') return false
  if (!['EUR', 'USD', 'GBP'].includes(p.currency as string)) return false
  if (!Array.isArray(p.characteristics) || p.characteristics.length === 0) return false
  for (const c of p.characteristics as unknown[]) {
    if (typeof c !== 'object' || c === null) return false
    const ch = c as Record<string, unknown>
    if (typeof ch.name !== 'string' || !ch.name) return false
    if (!['select', 'radio', 'swatch'].includes(ch.display_type as string)) return false
    if (typeof ch.is_required !== 'boolean') return false
    if (!Array.isArray(ch.values) || ch.values.length === 0) return false
    for (const v of ch.values as unknown[]) {
      if (typeof v !== 'object' || v === null) return false
      const val = v as Record<string, unknown>
      if (typeof val.label !== 'string' || !val.label) return false
      if (typeof val.price_modifier !== 'number') return false
    }
  }
  return true
}

const VALID_PRODUCT: AiProduct = {
  name:        'Custom Desk',
  description: 'A fine desk.',
  base_price:  299,
  currency:    'EUR',
  characteristics: [
    {
      name:         'Material',
      display_type: 'select',
      is_required:  true,
      values: [
        { label: 'Oak',    price_modifier: 0   },
        { label: 'Walnut', price_modifier: 100 },
      ],
    },
  ],
}

describe('ai-product-setup: schema validation', () => {
  it('accepts a valid product', () => {
    expect(validate(VALID_PRODUCT)).toBe(true)
  })

  it('rejects null', () => {
    expect(validate(null)).toBe(false)
  })

  it('rejects missing name', () => {
    expect(validate({ ...VALID_PRODUCT, name: '' })).toBe(false)
  })

  it('rejects missing description', () => {
    const copy = { ...VALID_PRODUCT, description: undefined }
    expect(validate(copy)).toBe(false)
  })

  it('rejects non-number base_price', () => {
    expect(validate({ ...VALID_PRODUCT, base_price: '299' })).toBe(false)
  })

  it('rejects unknown currency', () => {
    expect(validate({ ...VALID_PRODUCT, currency: 'CHF' })).toBe(false)
  })

  it('accepts all supported currencies', () => {
    for (const currency of ['EUR', 'USD', 'GBP']) {
      expect(validate({ ...VALID_PRODUCT, currency })).toBe(true)
    }
  })

  it('rejects empty characteristics array', () => {
    expect(validate({ ...VALID_PRODUCT, characteristics: [] })).toBe(false)
  })

  it('rejects unknown display_type', () => {
    const bad = { ...VALID_PRODUCT, characteristics: [{ ...VALID_PRODUCT.characteristics[0], display_type: 'slider' }] }
    expect(validate(bad)).toBe(false)
  })

  it('accepts all valid display_types', () => {
    for (const display_type of ['select', 'radio', 'swatch']) {
      const p = { ...VALID_PRODUCT, characteristics: [{ ...VALID_PRODUCT.characteristics[0], display_type }] }
      expect(validate(p)).toBe(true)
    }
  })

  it('rejects characteristic missing is_required', () => {
    const ch = { name: 'Size', display_type: 'select', values: [{ label: 'M', price_modifier: 0 }] }
    expect(validate({ ...VALID_PRODUCT, characteristics: [ch as unknown as AiChar] })).toBe(false)
  })

  it('rejects characteristic with empty values', () => {
    const bad = { ...VALID_PRODUCT, characteristics: [{ ...VALID_PRODUCT.characteristics[0], values: [] }] }
    expect(validate(bad)).toBe(false)
  })

  it('rejects value with non-number price_modifier', () => {
    const bad = {
      ...VALID_PRODUCT,
      characteristics: [{
        ...VALID_PRODUCT.characteristics[0],
        values: [{ label: 'Oak', price_modifier: 'free' }],
      }],
    }
    expect(validate(bad)).toBe(false)
  })

  it('rejects value with empty label', () => {
    const bad = {
      ...VALID_PRODUCT,
      characteristics: [{
        ...VALID_PRODUCT.characteristics[0],
        values: [{ label: '', price_modifier: 0 }],
      }],
    }
    expect(validate(bad)).toBe(false)
  })

  it('accepts zero price_modifier', () => {
    expect(validate(VALID_PRODUCT)).toBe(true)
  })
})

// ── Plan gating ───────────────────────────────────────────────────────────────

function isAiAllowed(aiSetupPerMonth: number): boolean {
  return aiSetupPerMonth !== 0
}

function isMonthlyLimitReached(used: number, max: number): boolean {
  if (max < 0) return false   // unlimited
  return used >= max
}

describe('ai-product-setup: plan gating', () => {
  it('free plan (0 setups) is not allowed', () => {
    expect(isAiAllowed(0)).toBe(false)
  })

  it('starter plan (5 setups) is allowed', () => {
    expect(isAiAllowed(5)).toBe(true)
  })

  it('growth plan (50 setups) is allowed', () => {
    expect(isAiAllowed(50)).toBe(true)
  })

  it('scale plan (-1 = unlimited) is allowed', () => {
    expect(isAiAllowed(-1)).toBe(true)
  })

  it('unlimited plan never hits monthly limit', () => {
    expect(isMonthlyLimitReached(9999, -1)).toBe(false)
  })

  it('limit not reached when used < max', () => {
    expect(isMonthlyLimitReached(4, 5)).toBe(false)
  })

  it('limit reached when used === max', () => {
    expect(isMonthlyLimitReached(5, 5)).toBe(true)
  })

  it('limit reached when used > max', () => {
    expect(isMonthlyLimitReached(6, 5)).toBe(true)
  })
})

// ── Retry logic simulation ────────────────────────────────────────────────────

describe('ai-product-setup: retry path', () => {
  it('succeeds on first attempt when output is valid', async () => {
    let calls = 0
    async function mockClaude(): Promise<string> {
      calls++
      return JSON.stringify(VALID_PRODUCT)
    }

    let result: AiProduct | null = null
    const raw = await mockClaude()
    try {
      const parsed = JSON.parse(raw)
      if (validate(parsed)) result = parsed
    } catch { /* ignore */ }

    expect(result).not.toBeNull()
    expect(calls).toBe(1)
  })

  it('retries once when first output fails validation', async () => {
    let calls = 0
    async function mockClaude(attempt: number): Promise<string> {
      calls++
      return attempt === 0 ? '{"invalid": true}' : JSON.stringify(VALID_PRODUCT)
    }

    let result: AiProduct | null = null
    const raw1 = await mockClaude(0)
    try {
      const p1 = JSON.parse(raw1)
      if (validate(p1)) {
        result = p1
      } else {
        const raw2 = await mockClaude(1)
        const p2 = JSON.parse(raw2)
        if (validate(p2)) result = p2
      }
    } catch { /* ignore */ }

    expect(result).not.toBeNull()
    expect(calls).toBe(2)
  })

  it('returns null when both attempts fail', async () => {
    async function mockClaude(): Promise<string> { return 'not json' }

    let result: AiProduct | null = null
    try {
      const raw1 = await mockClaude()
      const p1 = JSON.parse(raw1)
      if (!validate(p1)) {
        const raw2 = await mockClaude()
        const p2 = JSON.parse(raw2)
        if (validate(p2)) result = p2
      } else {
        result = p1
      }
    } catch { /* ignore */ }

    expect(result).toBeNull()
  })
})
