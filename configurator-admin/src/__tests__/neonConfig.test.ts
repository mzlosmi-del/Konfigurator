import { describe, it, expect } from 'vitest'
import { normalizeNeonConfig, isNeonConfigValid, DEFAULT_NEON_GLOW } from '@/lib/neonConfig'
import type { NeonConfig } from '@/types/database'

describe('normalizeNeonConfig (backward-compat)', () => {
  it('turns null into a feature-off draft (existing rows without the column)', () => {
    const n = normalizeNeonConfig(null)
    expect(n.enabled).toBe(false)
    expect(n.fonts).toEqual([])
    expect(n.colorCharId).toBeNull()
    expect(n.defaultGlowHex).toBe(DEFAULT_NEON_GLOW)
  })

  it('treats undefined the same as null', () => {
    expect(normalizeNeonConfig(undefined).enabled).toBe(false)
  })

  it('drops unknown font keys', () => {
    const cfg: NeonConfig = { enabled: true, fonts: ['pacifico', 'bogus-font', 'lobster'] }
    expect(normalizeNeonConfig(cfg).fonts).toEqual(['pacifico', 'lobster'])
  })

  it('preserves a fully-populated config round-trip', () => {
    const cfg: NeonConfig = {
      enabled: true,
      label: 'Your name in lights',
      maxLength: 24,
      fonts: ['monoton', 'pacifico'],
      colorCharId: 'char-colour',
      glowColorMap: { 'val-red': '#ff0000' },
      defaultGlowHex: '#00ffcc',
    }
    const n = normalizeNeonConfig(cfg)
    expect(n).toEqual(cfg)
  })
})

describe('isNeonConfigValid', () => {
  it('is false when off or null', () => {
    expect(isNeonConfigValid(null)).toBe(false)
    expect(isNeonConfigValid({ enabled: false, fonts: ['pacifico'] })).toBe(false)
  })

  it('is false when enabled but no valid font is offered', () => {
    expect(isNeonConfigValid({ enabled: true, fonts: [] })).toBe(false)
    expect(isNeonConfigValid({ enabled: true, fonts: ['bogus'] })).toBe(false)
  })

  it('is true when enabled with at least one valid font', () => {
    expect(isNeonConfigValid({ enabled: true, fonts: ['pacifico'] })).toBe(true)
  })
})
