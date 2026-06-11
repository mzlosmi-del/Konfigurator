import { h } from 'preact'
import { neonFontCss } from '../neonFonts'
import { neonSceneBackground } from '../neonScenes'

interface Props {
  /** The typed sign text. Empty → the placeholder is shown, dimmed. */
  text: string
  /** Placeholder shown (dimmed) when `text` is empty. */
  placeholder: string
  /** Resolved glow colour (validated hex) — the default for every character. */
  glowHex: string
  /** Selected font key from the neon catalogue (undefined → cursive fallback). */
  fontKey?: string
  /** When true, characters are individually coloured and clickable so the
   *  customer can paint each one. Off ⇒ the whole text glows in `glowHex`. */
  perChar?: boolean
  /** Per-character colour overrides, keyed by character index. */
  charColors?: Record<number, string>
  /** The character index currently selected for painting (highlighted). */
  selectedIndex?: number | null
  /** Fired when the customer clicks a character (per-char mode only). */
  onSelectChar?: (index: number) => void
  /** Background-scene key (from neonScenes). Absent/`none` ⇒ the plain panel. */
  sceneKey?: string
}

// Pure presentational neon glow. The glow is layered text-shadows (increasing
// blur in the tube colour) plus a near-white inner core, all built from inline
// CSS custom properties so colour/text/font update live with no re-injection.
// The actual shadow stack lives in styles.ts (.cw-neon-text) and reads these
// vars — keeping the heavy CSS in the shared stylesheet, not per-render inline.
export function NeonPreview({
  text,
  placeholder,
  glowHex,
  fontKey,
  perChar = false,
  charColors,
  selectedIndex,
  onSelectChar,
  sceneKey,
}: Props) {
  const isEmpty = text.length === 0
  const family  = neonFontCss(fontKey)

  // Background scene sits behind the glow as an absolutely-filled CSS layer.
  // Empty string for `none`/unknown → no scene layer rendered (plain panel).
  const sceneBg = neonSceneBackground(sceneKey)
  const scene = sceneBg
    ? <div class="cw-neon-scene" style={`background-image:${sceneBg};`} aria-hidden="true" />
    : null

  // Single-colour mode (and the empty placeholder): one glow var for all text.
  if (!perChar || isEmpty) {
    const shown = isEmpty ? placeholder : text
    const style = `--cw-neon-glow:${glowHex};font-family:${family};`
    return (
      <div class="cw-neon-panel">
        {scene}
        <div class={`cw-neon-text${isEmpty ? ' cw-neon-text--placeholder' : ''}`} style={style}>
          {shown}
        </div>
      </div>
    )
  }

  // Per-character mode: each character is its own glowing, clickable span so the
  // customer can paint it. Spaces are rendered but not selectable.
  return (
    <div class="cw-neon-panel">
      {scene}
      <div class="cw-neon-text cw-neon-text--perchar" style={`font-family:${family};`}>
        {Array.from(text).map((ch, i) => {
          if (ch === ' ') return <span class="cw-neon-space"> </span>
          const color = charColors?.[i] ?? glowHex
          const selected = selectedIndex === i
          return (
            <span
              role="button"
              tabindex={0}
              class={`cw-neon-char${selected ? ' selected' : ''}`}
              style={`--cw-neon-glow:${color};`}
              onClick={() => onSelectChar?.(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectChar?.(i) }
              }}
            >
              {ch}
            </span>
          )
        })}
      </div>
    </div>
  )
}
