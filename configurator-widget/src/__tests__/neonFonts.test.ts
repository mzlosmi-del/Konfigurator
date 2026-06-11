import { describe, it, expect } from 'vitest'
import { NEON_FONTS, getNeonFont, neonFontCss } from '../neonFonts'
import { ensureNeonFont, ensureNeonFonts } from '../fonts'

describe('neon font catalogue', () => {
  it('exposes exactly 10 fonts with unique keys', () => {
    expect(NEON_FONTS).toHaveLength(10)
    const keys = new Set(NEON_FONTS.map(f => f.key))
    expect(keys.size).toBe(10)
  })

  it('every font has a non-empty family, css stack and Google param', () => {
    for (const f of NEON_FONTS) {
      expect(f.family.length).toBeGreaterThan(0)
      expect(f.css).toContain(f.family)
      expect(f.param.length).toBeGreaterThan(0)
    }
  })

  it('getNeonFont resolves known keys and rejects unknown', () => {
    expect(getNeonFont('pacifico')?.family).toBe('Pacifico')
    expect(getNeonFont('nope')).toBeUndefined()
    expect(getNeonFont(null)).toBeUndefined()
    expect(getNeonFont(undefined)).toBeUndefined()
  })

  it('neonFontCss falls back to cursive for unknown keys', () => {
    expect(neonFontCss('great-vibes')).toContain('Great Vibes')
    expect(neonFontCss('nope')).toBe('cursive')
    expect(neonFontCss(undefined)).toBe('cursive')
  })
})

describe('ensureNeonFont (no DOM)', () => {
  // In the node test env there is no document; the helper must no-op safely
  // rather than throw. (DOM injection + dedupe is verified manually — see the
  // acceptance walkthrough; we don't pull jsdom into the widget test config.)
  it('does not throw when document is unavailable', () => {
    expect(() => ensureNeonFont('pacifico')).not.toThrow()
    expect(() => ensureNeonFonts(['pacifico', 'lobster'])).not.toThrow()
  })
})
