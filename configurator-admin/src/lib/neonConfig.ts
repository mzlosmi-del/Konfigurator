import type { NeonConfig } from '@/types/database'
import { NEON_FONTS } from '@/lib/neonFonts'

export const DEFAULT_NEON_GLOW = '#ff2d95'

const VALID_FONT_KEYS = new Set(NEON_FONTS.map(f => f.key))

/** Turn a possibly-null/partial stored config into a complete editable draft.
 *  Used by the editor so partial DB rows (or null) become a stable shape. */
export function normalizeNeonConfig(config: NeonConfig | null | undefined): NeonConfig {
  return {
    enabled:        config?.enabled === true,
    label:          config?.label,
    maxLength:      config?.maxLength ?? null,
    fonts:          (config?.fonts ?? []).filter(k => VALID_FONT_KEYS.has(k)),
    colorCharId:    config?.colorCharId ?? null,
    glowColorMap:   config?.glowColorMap ?? {},
    defaultGlowHex: config?.defaultGlowHex ?? DEFAULT_NEON_GLOW,
  }
}

/** A config is "on" only when explicitly enabled with at least one valid font.
 *  Mirrors the widget's gate (NeonConfig.enabled === true) plus the practical
 *  requirement that a customer can pick a font. */
export function isNeonConfigValid(config: NeonConfig | null | undefined): boolean {
  if (config?.enabled !== true) return false
  return (config.fonts ?? []).some(k => VALID_FONT_KEYS.has(k))
}
