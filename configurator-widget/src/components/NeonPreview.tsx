import { h } from 'preact'
import { neonFontCss } from '../neonFonts'

interface Props {
  /** The typed sign text. Empty → the placeholder is shown, dimmed. */
  text: string
  /** Placeholder shown (dimmed) when `text` is empty. */
  placeholder: string
  /** Resolved glow colour (validated hex). */
  glowHex: string
  /** Selected font key from the neon catalogue (undefined → cursive fallback). */
  fontKey?: string
}

// Pure presentational neon glow. The glow is layered text-shadows (increasing
// blur in the tube colour) plus a near-white inner core, all built from inline
// CSS custom properties so colour/text/font update live with no re-injection.
// The actual shadow stack lives in styles.ts (.cw-neon-text) and reads these
// vars — keeping the heavy CSS in the shared stylesheet, not per-render inline.
export function NeonPreview({ text, placeholder, glowHex, fontKey }: Props) {
  const isEmpty = text.length === 0
  const shown   = isEmpty ? placeholder : text
  const family  = neonFontCss(fontKey)

  // Inline custom props drive the glow defined in styles.ts.
  const style = `--cw-neon-glow:${glowHex};font-family:${family};`

  return (
    <div class="cw-neon-panel" aria-hidden="true">
      <div class={`cw-neon-text${isEmpty ? ' cw-neon-text--placeholder' : ''}`} style={style}>
        {shown}
      </div>
    </div>
  )
}
