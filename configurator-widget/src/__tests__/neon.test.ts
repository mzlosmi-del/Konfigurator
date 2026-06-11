import { describe, it, expect } from 'vitest'
import {
  isNeonEnabled,
  resolveGlowHex,
  normalizeHex,
  neonMaxLength,
  DEFAULT_NEON_HEX,
} from '../neon'
import type { Characteristic, NeonConfig, Selection, ColorInputs } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const swatchChar: Characteristic = {
  id: 'char-color',
  name: 'Colour',
  display_type: 'swatch',
  sort_order: 0,
  values: [
    { id: 'val-pink', label: 'Pink', price_modifier: 0, sort_order: 0, hex_color: '#ff00aa' },
    { id: 'val-blue', label: 'Blue', price_modifier: 0, sort_order: 1, hex_color: '#00aaff' },
    { id: 'val-nohex', label: 'Plain', price_modifier: 0, sort_order: 2, hex_color: null },
  ],
}

const colorPickerChar: Characteristic = {
  id: 'char-pick',
  name: 'Tube colour',
  display_type: 'color',
  sort_order: 0,
  values: [],
}

function neonTextChar(neon: NeonConfig | null, over: Partial<Characteristic> = {}): Characteristic {
  return {
    id: 'char-text',
    name: 'Sign text',
    display_type: 'text',
    sort_order: 1,
    values: [],
    neon_config: neon,
    ...over,
  }
}

const baseNeon: NeonConfig = { enabled: true, fonts: ['pacifico'] }

// ─── isNeonEnabled ────────────────────────────────────────────────────────────

describe('isNeonEnabled', () => {
  it('is false for a text char with no neon_config (feature off — regression guard)', () => {
    expect(isNeonEnabled(neonTextChar(null))).toBe(false)
    expect(isNeonEnabled(neonTextChar(undefined as never))).toBe(false)
  })

  it('is false when enabled !== true', () => {
    expect(isNeonEnabled(neonTextChar({ enabled: false, fonts: [] }))).toBe(false)
  })

  it('is false for non-text characteristics even if a config leaked in', () => {
    expect(isNeonEnabled({ ...swatchChar, neon_config: baseNeon })).toBe(false)
  })

  it('is true for an enabled text char', () => {
    expect(isNeonEnabled(neonTextChar(baseNeon))).toBe(true)
  })
})

// ─── normalizeHex ─────────────────────────────────────────────────────────────

describe('normalizeHex', () => {
  it('accepts #rrggbb and #rgb, lowercased', () => {
    expect(normalizeHex('#FF00AA')).toBe('#ff00aa')
    expect(normalizeHex('#abc')).toBe('#abc')
  })
  it('rejects junk', () => {
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#12')).toBeNull()
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex(null)).toBeNull()
    expect(normalizeHex(undefined)).toBeNull()
  })
})

// ─── resolveGlowHex (colour mapping + fallback chain) ─────────────────────────

describe('resolveGlowHex', () => {
  const emptySel: Selection = {}
  const emptyColors: ColorInputs = {}

  it('falls back to defaultGlowHex when no colour char is bound', () => {
    const neon: NeonConfig = { ...baseNeon, defaultGlowHex: '#123456' }
    expect(resolveGlowHex(neon, undefined, emptySel, emptyColors)).toBe('#123456')
  })

  it('falls back to the built-in default when nothing is configured', () => {
    expect(resolveGlowHex(baseNeon, undefined, emptySel, emptyColors)).toBe(DEFAULT_NEON_HEX)
  })

  it('uses the selected swatch value hex_color', () => {
    const neon: NeonConfig = { ...baseNeon, colorCharId: swatchChar.id }
    const sel: Selection = { [swatchChar.id]: 'val-blue' }
    expect(resolveGlowHex(neon, swatchChar, sel, emptyColors)).toBe('#00aaff')
  })

  it('prefers the glowColorMap override over the swatch hex', () => {
    const neon: NeonConfig = { ...baseNeon, colorCharId: swatchChar.id, glowColorMap: { 'val-blue': '#abcdef' } }
    const sel: Selection = { [swatchChar.id]: 'val-blue' }
    expect(resolveGlowHex(neon, swatchChar, sel, emptyColors)).toBe('#abcdef')
  })

  it('falls back to default when the selected value has no hex', () => {
    const neon: NeonConfig = { ...baseNeon, colorCharId: swatchChar.id, defaultGlowHex: '#222222' }
    const sel: Selection = { [swatchChar.id]: 'val-nohex' }
    expect(resolveGlowHex(neon, swatchChar, sel, emptyColors)).toBe('#222222')
  })

  it('falls back to default when nothing is selected on the bound char', () => {
    const neon: NeonConfig = { ...baseNeon, colorCharId: swatchChar.id, defaultGlowHex: '#333333' }
    expect(resolveGlowHex(neon, swatchChar, emptySel, emptyColors)).toBe('#333333')
  })

  it('reads the free-form color picker input', () => {
    const neon: NeonConfig = { ...baseNeon, colorCharId: colorPickerChar.id }
    const colors: ColorInputs = { [colorPickerChar.id]: '#0f0f0f' }
    expect(resolveGlowHex(neon, colorPickerChar, emptySel, colors)).toBe('#0f0f0f')
  })

  it('ignores an invalid override and uses the fallback', () => {
    const neon: NeonConfig = { ...baseNeon, colorCharId: swatchChar.id, glowColorMap: { 'val-blue': 'not-a-color' }, defaultGlowHex: '#444444' }
    const sel: Selection = { [swatchChar.id]: 'val-blue' }
    expect(resolveGlowHex(neon, swatchChar, sel, emptyColors)).toBe('#444444')
  })
})

// ─── neonMaxLength ────────────────────────────────────────────────────────────

describe('neonMaxLength', () => {
  it('prefers the explicit maxLength', () => {
    expect(neonMaxLength(neonTextChar({ ...baseNeon, maxLength: 12 }))).toBe(12)
  })
  it('falls back to numeric_max, then to 30', () => {
    expect(neonMaxLength(neonTextChar(baseNeon, { numeric_max: 20 }))).toBe(20)
    expect(neonMaxLength(neonTextChar(baseNeon))).toBe(30)
  })
})

// ─── Char count parity (spaces count — matches existing text pricing) ─────────

describe('character count parity with existing text type', () => {
  // The widget mirrors text.length into numericInputs (Widget.handleTextInput).
  // Neon must not change that — the priced count includes spaces.
  it('counts spaces, so derived count equals raw string length', () => {
    const text = 'JOES BARBERS'
    expect(text.length).toBe(12)
    // A neon char prices identically to a plain text char of the same value.
    const plain = neonTextChar(null)
    const neon = neonTextChar(baseNeon)
    const pricePerChar = 2
    const priceOf = (c: Characteristic) =>
      text.length * (c.price_per_char ?? pricePerChar)
    expect(priceOf(neon)).toBe(priceOf(plain))
    expect(priceOf(neon)).toBe(24)
  })
})
