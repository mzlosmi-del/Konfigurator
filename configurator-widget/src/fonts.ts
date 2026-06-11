import { getNeonFont } from './neonFonts'

// Lazy, idempotent loader for the neon-preview web fonts.
//
// @font-face declared inside a Shadow DOM is unreliable across browsers
// (Firefox/Safari won't always apply it to shadow content), so the Google
// Fonts stylesheet must live in the HOST document.head instead — fonts loaded
// there ARE visible to shadow content. This mirrors the existing model-viewer
// CDN injection in components/Visualization.tsx.
//
// Each font gets its own <link> tagged with data-cw-neon-font="<key>" so:
//   • re-mounting the widget, or embedding several widgets, never duplicates it;
//   • we leak nothing global beyond Google's own @font-face rules, which are
//     namespaced by their unique family names and so can't clash with the host.
//
// Guarded for SSR / non-DOM test environments (no document).

export function ensureNeonFont(fontKey: string): void {
  if (typeof document === 'undefined') return
  const font = getNeonFont(fontKey)
  if (!font) return

  const selector = `link[data-cw-neon-font="${fontKey}"]`
  if (document.head.querySelector(selector)) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.setAttribute('data-cw-neon-font', fontKey)
  // display=swap → the fallback cursive shows immediately, then swaps in the
  // web font when ready (no invisible-text flash).
  link.href = `https://fonts.googleapis.com/css2?family=${font.param}&display=swap`
  document.head.appendChild(link)
}

/** Inject every font in the list (deduped by ensureNeonFont's guard). */
export function ensureNeonFonts(fontKeys: string[]): void {
  for (const k of fontKeys) ensureNeonFont(k)
}
