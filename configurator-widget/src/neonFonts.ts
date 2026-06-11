// Bundled font catalogue for the live neon-text preview.
//
// Ten Google-hosted handwriting / display fonts suited to neon-sign mock-ups.
// The font FILES are never bundled into widget.js — they're fetched on demand
// from Google Fonts via a <link> injected into document.head (see fonts.ts),
// only when a product actually uses the neon feature. So the JS bundle cost is
// just this small static table.
//
// `key`    — stable id stored in NeonConfig.fonts and selected at runtime.
// `family` — the CSS font-family name Google serves (must match exactly).
// `css`    — fallback stack applied while the web font is still loading.
// `param`  — the `family=` query value for the Google Fonts CSS API (v2).

export interface NeonFont {
  key:    string
  family: string
  css:    string
  param:  string
}

const FALLBACK = "cursive"

export const NEON_FONTS: NeonFont[] = [
  { key: 'pacifico',        family: 'Pacifico',          css: `'Pacifico', ${FALLBACK}`,          param: 'Pacifico' },
  { key: 'permanent-marker',family: 'Permanent Marker',  css: `'Permanent Marker', ${FALLBACK}`,  param: 'Permanent+Marker' },
  { key: 'dancing-script',  family: 'Dancing Script',    css: `'Dancing Script', ${FALLBACK}`,    param: 'Dancing+Script:wght@400..700' },
  { key: 'satisfy',         family: 'Satisfy',           css: `'Satisfy', ${FALLBACK}`,           param: 'Satisfy' },
  { key: 'caveat',          family: 'Caveat',            css: `'Caveat', ${FALLBACK}`,            param: 'Caveat:wght@400..700' },
  { key: 'kaushan-script',  family: 'Kaushan Script',    css: `'Kaushan Script', ${FALLBACK}`,    param: 'Kaushan+Script' },
  { key: 'sacramento',      family: 'Sacramento',        css: `'Sacramento', ${FALLBACK}`,        param: 'Sacramento' },
  { key: 'great-vibes',     family: 'Great Vibes',       css: `'Great Vibes', ${FALLBACK}`,       param: 'Great+Vibes' },
  { key: 'monoton',         family: 'Monoton',           css: `'Monoton', ${FALLBACK}`,           param: 'Monoton' },
  { key: 'lobster',         family: 'Lobster',           css: `'Lobster', ${FALLBACK}`,           param: 'Lobster' },
]

const BY_KEY = new Map(NEON_FONTS.map(f => [f.key, f]))

/** Look up a font by key; returns undefined for unknown keys. */
export function getNeonFont(key: string | undefined | null): NeonFont | undefined {
  return key ? BY_KEY.get(key) : undefined
}

/** The CSS font-family stack for a key, falling back to a generic cursive when
 *  the key is unknown or absent. */
export function neonFontCss(key: string | undefined | null): string {
  return getNeonFont(key)?.css ?? FALLBACK
}
