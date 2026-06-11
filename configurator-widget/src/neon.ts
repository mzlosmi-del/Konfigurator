import type { Characteristic, NeonConfig, Selection, ColorInputs } from './types'

// Pure helpers for the neon-text preview. Kept out of the component so they're
// unit-testable without a DOM and reused by Widget.tsx.

/** Built-in fallback glow when a product configures neither a bound colour nor
 *  a defaultGlowHex. A warm pink reads well on the dark preview panel. */
export const DEFAULT_NEON_HEX = '#ff2d95'

/** True when this characteristic should render the live glow preview. */
export function isNeonEnabled(char: Characteristic): boolean {
  return char.display_type === 'text' && char.neon_config?.enabled === true
}

/** Resolve the glow colour for a neon characteristic from the current config.
 *
 *  Precedence:
 *    1. glowColorMap[selectedValueId]  — explicit per-value override
 *    2. the bound value's own hex_color (swatch) or chosen hex (color input)
 *    3. neon_config.defaultGlowHex
 *    4. DEFAULT_NEON_HEX
 *
 *  `colorChar` is the sibling characteristic named by neon_config.colorCharId
 *  (may be undefined if unset or stale). For swatch/select/radio/toggle types
 *  the chosen value's hex_color is used; for the free-form 'color' type the
 *  customer's picked hex (from colorInputs) is used.
 */
export function resolveGlowHex(
  neon: NeonConfig,
  colorChar: Characteristic | undefined,
  selection: Selection,
  colorInputs: ColorInputs,
): string {
  const fallback = neon.defaultGlowHex || DEFAULT_NEON_HEX

  if (!colorChar) return fallback

  if (colorChar.display_type === 'color') {
    const hex = colorInputs[colorChar.id]
    return normalizeHex(hex) ?? fallback
  }

  const valueId = selection[colorChar.id]
  if (!valueId) return fallback

  const override = neon.glowColorMap?.[valueId]
  if (override) return normalizeHex(override) ?? fallback

  const value = colorChar.values.find(v => v.id === valueId)
  return normalizeHex(value?.hex_color) ?? fallback
}

/** Accept a #rgb / #rrggbb string; return it lowercased, or null if it isn't a
 *  valid hex colour. Guards against junk in glowColorMap / hex_color. */
export function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) return null
  const h = hex.trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h) ? h.toLowerCase() : null
}

/** The effective UI character cap for a neon input: explicit maxLength, else the
 *  priced numeric_max bound, else the default of 30. */
export function neonMaxLength(char: Characteristic): number {
  const cfg = char.neon_config
  if (cfg?.maxLength != null) return cfg.maxLength
  if (char.numeric_max != null) return char.numeric_max
  return 30
}
