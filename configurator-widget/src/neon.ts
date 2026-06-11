import type { Characteristic, NeonConfig, Selection, ColorInputs } from './types'
import { getNeonScene } from './neonScenes'

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

/** True when this neon characteristic lets the customer paint each character a
 *  separate colour. */
export function isPerCharColors(char: Characteristic): boolean {
  return isNeonEnabled(char) && char.neon_config?.perCharColors === true
}

/** One selectable glow colour offered to the customer when painting characters:
 *  a swatch value with its (override-aware) hex. Built from the bound colour
 *  characteristic. Empty when no swatch char is bound or it has no hex values. */
export interface NeonSwatch {
  valueId: string
  label: string
  hex: string
}

/** The palette the customer paints from in per-character mode: the bound
 *  colour/swatch characteristic's values, each resolved to a hex (glowColorMap
 *  override → value.hex_color), dropping values with no usable colour. */
export function neonSwatchPalette(
  neon: NeonConfig,
  colorChar: Characteristic | undefined,
): NeonSwatch[] {
  if (!colorChar || colorChar.display_type === 'color') return []
  const out: NeonSwatch[] = []
  for (const v of colorChar.values) {
    const hex = normalizeHex(neon.glowColorMap?.[v.id]) ?? normalizeHex(v.hex_color)
    if (hex) out.push({ valueId: v.id, label: v.label, hex })
  }
  return out
}

/** The background scenes a neon characteristic offers, filtered to keys the
 *  bundled catalogue actually knows about. Empty ⇒ no scene picker. */
export function offeredScenes(neon: NeonConfig): string[] {
  return (neon.backgrounds ?? []).filter(k => getNeonScene(k))
}

/** Human-readable scene label for the inquiry/PDF note. Returns '' for the
 *  `none` sentinel or an unknown key, so callers can omit the note. */
export function describeNeonScene(sceneKey: string | undefined | null): string {
  if (!sceneKey || sceneKey === 'none') return ''
  return getNeonScene(sceneKey)?.label ?? ''
}

/** Build a readable "which colour each character is" note for the inquiry/PDF,
 *  e.g. "J=#ff0000, O=#00ff00". Only lists characters whose colour was
 *  explicitly painted (differs from the default). Returns '' when nothing was
 *  customised, so callers can omit the note entirely. Spaces are skipped. */
export function describeNeonColors(
  text: string,
  charColors: Record<number, string> | undefined,
): string {
  if (!charColors) return ''
  const parts: string[] = []
  const chars = Array.from(text)
  for (let i = 0; i < chars.length; i++) {
    const hex = charColors[i]
    if (!hex || chars[i] === ' ') continue
    parts.push(`${chars[i]}=${hex}`)
  }
  return parts.join(', ')
}
