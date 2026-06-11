// Neon-preview font catalogue (admin copy).
//
// Mirrors configurator-widget/src/neonFonts.ts — the two packages don't share
// code, so the `key` values here MUST stay in sync with the widget's. The admin
// only needs the key + display family (it doesn't load the fonts), so this is a
// lighter table than the widget's.

export interface NeonFontMeta {
  key:    string
  family: string
}

export const NEON_FONTS: NeonFontMeta[] = [
  { key: 'pacifico',         family: 'Pacifico' },
  { key: 'permanent-marker', family: 'Permanent Marker' },
  { key: 'dancing-script',   family: 'Dancing Script' },
  { key: 'satisfy',          family: 'Satisfy' },
  { key: 'caveat',           family: 'Caveat' },
  { key: 'kaushan-script',   family: 'Kaushan Script' },
  { key: 'sacramento',       family: 'Sacramento' },
  { key: 'great-vibes',      family: 'Great Vibes' },
  { key: 'monoton',          family: 'Monoton' },
  { key: 'lobster',          family: 'Lobster' },
]
