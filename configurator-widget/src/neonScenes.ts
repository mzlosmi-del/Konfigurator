// Bundled background-scene catalogue for the neon-text preview.
//
// Each scene is a self-contained SVG STRING (16:9, viewBox 0 0 1600 900) that
// renders as the backdrop behind the glowing sign. They're hand-authored vector
// illustrations — dark and muted so the neon glow still pops — kept compact
// (gradients + a handful of shapes, no embedded raster) so the IIFE bundle cost
// is just their bytes. Applied as a data-URI CSS background in NeonPreview, so
// nothing is injected as innerHTML.
//
// `none` is the default (no scene) — the panel keeps its plain dark gradient.
//
// NB: the `key`s here MUST stay in sync with the admin catalogue in
// configurator-admin/src/lib/neonScenes.ts (the two packages don't share code).

export interface NeonScene {
  key:   string
  label: string
  /** Full SVG markup, or '' for the `none` sentinel (plain panel). */
  svg:   string
}

const W = 1600
const H = 900

// ── Brick bar wall: exposed brick, a back-bar shelf with bottle silhouettes ──
const BAR_WALL = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bw-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a1c17"/>
      <stop offset="1" stop-color="#160e0b"/>
    </linearGradient>
    <radialGradient id="bw-amb" cx="50%" cy="38%" r="60%">
      <stop offset="0" stop-color="#5a3a22" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <pattern id="bw-brick" width="160" height="92" patternUnits="userSpaceOnUse">
      <rect width="160" height="92" fill="url(#bw-wall)"/>
      <g fill="none" stroke="#0c0705" stroke-width="6">
        <path d="M0 46 H160 M0 92 H160"/>
        <path d="M80 0 V46 M0 46 V92 M160 46 V92"/>
      </g>
      <g fill="#3a261d" opacity="0.5">
        <rect x="6" y="6" width="68" height="34" rx="3"/>
        <rect x="86" y="52" width="68" height="34" rx="3"/>
      </g>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bw-wall)"/>
  <rect width="${W}" height="${H}" fill="url(#bw-brick)"/>
  <rect width="${W}" height="${H}" fill="url(#bw-amb)"/>
  <!-- back-bar shelf -->
  <rect x="0" y="640" width="${W}" height="22" fill="#1c130e"/>
  <rect x="0" y="662" width="${W}" height="238" fill="#120b08"/>
  <g opacity="0.85">
    <rect x="120" y="540" width="34" height="100" rx="6" fill="#241712"/>
    <rect x="170" y="560" width="26" height="80" rx="6" fill="#2c1d14"/>
    <rect x="214" y="528" width="30" height="112" rx="6" fill="#1f1410"/>
    <rect x="1360" y="548" width="32" height="92" rx="6" fill="#241712"/>
    <rect x="1408" y="566" width="24" height="74" rx="6" fill="#2c1d14"/>
    <rect x="1300" y="536" width="28" height="104" rx="6" fill="#1f1410"/>
  </g>
  <rect width="${W}" height="${H}" fill="#000" opacity="0.18"/>
</svg>`

// ── Storefront at dusk: window mullions, awning, soft street glow outside ──
const STOREFRONT = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sf-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14233a"/>
      <stop offset="0.6" stop-color="#243a52"/>
      <stop offset="1" stop-color="#3a2f3e"/>
    </linearGradient>
    <radialGradient id="sf-street" cx="50%" cy="78%" r="55%">
      <stop offset="0" stop-color="#caa15a" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- view through the window -->
  <rect width="${W}" height="${H}" fill="url(#sf-sky)"/>
  <rect width="${W}" height="${H}" fill="url(#sf-street)"/>
  <g opacity="0.4" fill="#0c1320">
    <rect x="120" y="300" width="180" height="360"/>
    <rect x="360" y="240" width="150" height="420"/>
    <rect x="1120" y="280" width="170" height="380"/>
    <rect x="1330" y="330" width="150" height="330"/>
  </g>
  <g fill="#f4d58b" opacity="0.7">
    <rect x="150" y="360" width="20" height="20"/><rect x="200" y="420" width="20" height="20"/>
    <rect x="390" y="300" width="18" height="18"/><rect x="440" y="380" width="18" height="18"/>
    <rect x="1160" y="340" width="18" height="18"/><rect x="1380" y="400" width="18" height="18"/>
  </g>
  <!-- awning -->
  <path d="M0 150 L${W} 150 L${W} 96 L0 96 Z" fill="#3a1d20"/>
  <g>
    <path d="M0 150 L160 230 L160 150 Z" fill="#5a2c30"/>
    <path d="M200 150 L360 230 L360 150 Z" fill="#4a2429"/>
    <path d="M400 150 L560 230 L560 150 Z" fill="#5a2c30"/>
    <path d="M600 150 L760 230 L760 150 Z" fill="#4a2429"/>
    <path d="M800 150 L960 230 L960 150 Z" fill="#5a2c30"/>
    <path d="M1000 150 L1160 230 L1160 150 Z" fill="#4a2429"/>
    <path d="M1200 150 L1360 230 L1360 150 Z" fill="#5a2c30"/>
    <path d="M1400 150 L1560 230 L1560 150 Z" fill="#4a2429"/>
  </g>
  <!-- window frame / mullions -->
  <g stroke="#0a0d12" stroke-width="26" fill="none">
    <rect x="40" y="150" width="1520" height="710"/>
    <path d="M800 150 V860 M40 500 H1560"/>
  </g>
  <g stroke="#0a0d12" stroke-width="12" fill="none" opacity="0.8">
    <path d="M420 150 V860 M1180 150 V860"/>
  </g>
  <rect x="0" y="846" width="${W}" height="54" fill="#0a0d12"/>
  <rect width="${W}" height="${H}" fill="#0a1018" opacity="0.28"/>
</svg>`

// ── Wrought-iron gate at night: dark archway, iron bars, cobblestone glow ──
const GATE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="gt-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c1118"/>
      <stop offset="1" stop-color="#05070a"/>
    </linearGradient>
    <radialGradient id="gt-moon" cx="50%" cy="30%" r="50%">
      <stop offset="0" stop-color="#3b4a63" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#gt-bg)"/>
  <rect width="${W}" height="${H}" fill="url(#gt-moon)"/>
  <!-- stone pillars -->
  <rect x="60" y="80" width="150" height="820" fill="#14181f"/>
  <rect x="1390" y="80" width="150" height="820" fill="#14181f"/>
  <rect x="40" y="56" width="190" height="40" rx="6" fill="#1b2129"/>
  <rect x="1370" y="56" width="190" height="40" rx="6" fill="#1b2129"/>
  <!-- iron bars + arch -->
  <g stroke="#191e26" stroke-width="14" fill="none" stroke-linecap="round">
    <path d="M210 240 H1390"/>
    <path d="M210 240 Q800 120 1390 240"/>
    ${Array.from({ length: 17 }, (_, i) => {
      const x = 270 + i * 64
      return `<path d="M${x} 250 V880"/>`
    }).join('')}
    <path d="M210 560 H1390 M210 760 H1390"/>
  </g>
  <!-- finials -->
  <g fill="#222833">
    ${Array.from({ length: 17 }, (_, i) => {
      const x = 270 + i * 64
      return `<circle cx="${x}" cy="250" r="9"/>`
    }).join('')}
  </g>
  <rect x="0" y="864" width="${W}" height="36" fill="#0a0d12"/>
  <rect width="${W}" height="${H}" fill="#04060a" opacity="0.22"/>
</svg>`

// ── Clean studio: seamless neutral wall with a soft floor sweep + vignette ──
const STUDIO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="st-key" cx="50%" cy="34%" r="62%">
      <stop offset="0" stop-color="#3a3d44"/>
      <stop offset="0.55" stop-color="#24262b"/>
      <stop offset="1" stop-color="#121317"/>
    </radialGradient>
    <linearGradient id="st-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d1f24"/>
      <stop offset="1" stop-color="#0c0d10"/>
    </linearGradient>
    <radialGradient id="st-pool" cx="50%" cy="100%" r="45%">
      <stop offset="0" stop-color="#46494f" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#st-key)"/>
  <!-- seamless sweep: wall curving into floor -->
  <path d="M0 620 Q800 560 ${W} 620 L${W} ${H} L0 ${H} Z" fill="url(#st-floor)"/>
  <path d="M0 620 Q800 560 ${W} 620" stroke="#000" stroke-width="2" fill="none" opacity="0.4"/>
  <ellipse cx="800" cy="${H}" rx="700" ry="200" fill="url(#st-pool)"/>
  <rect width="${W}" height="${H}" fill="#000" opacity="0.12"/>
</svg>`

export const NEON_SCENES: NeonScene[] = [
  { key: 'none',       label: 'None (dark)',   svg: '' },
  { key: 'bar-wall',   label: 'Bar wall',      svg: BAR_WALL },
  { key: 'storefront', label: 'Storefront',    svg: STOREFRONT },
  { key: 'gate',       label: 'Gate at night', svg: GATE },
  { key: 'studio',     label: 'Studio wall',   svg: STUDIO },
]

const BY_KEY = new Map(NEON_SCENES.map(s => [s.key, s]))

/** Look up a scene by key; undefined for unknown keys. */
export function getNeonScene(key: string | undefined | null): NeonScene | undefined {
  return key ? BY_KEY.get(key) : undefined
}

/** A CSS-ready `url("data:image/svg+xml,...")` for a scene, or '' when the scene
 *  is `none`/unknown/empty (caller then falls back to the plain panel). */
export function neonSceneBackground(key: string | undefined | null): string {
  const scene = getNeonScene(key)
  if (!scene || !scene.svg) return ''
  // encodeURIComponent keeps the SVG valid inside a CSS url() data-URI — it
  // escapes '#' (which would otherwise terminate the URL), quotes, angle
  // brackets, and whitespace.
  return `url("data:image/svg+xml,${encodeURIComponent(scene.svg.trim())}")`
}
