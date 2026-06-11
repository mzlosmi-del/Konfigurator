// Neon background-scene catalogue (admin copy).
//
// Mirrors configurator-widget/src/neonScenes.ts — the two packages don't share
// code, so the `key` values here MUST stay in sync with the widget's. The admin
// only needs key + label for the "offered backgrounds" multi-select (it doesn't
// render the SVG art), so this is a lighter table than the widget's.

export interface NeonSceneMeta {
  key:   string
  label: string
}

export const NEON_SCENES: NeonSceneMeta[] = [
  { key: 'bar-wall',   label: 'Bar wall' },
  { key: 'storefront', label: 'Storefront' },
  { key: 'gate',       label: 'Gate at night' },
  { key: 'studio',     label: 'Studio wall' },
]
// Note: the widget catalogue also has a `none` (plain panel) sentinel, which is
// always available implicitly — admins choose only from the real scenes above.
