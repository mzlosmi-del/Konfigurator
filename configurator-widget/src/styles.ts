export const WIDGET_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    /* ── Theme defaults (Cloud) — overridden per-theme via themeToStyleBlock() ── */
    --cw-font:             system-ui,-apple-system,sans-serif;
    --cw-font-display:     Georgia,'Times New Roman',serif;
    --cw-bg:               #ffffff;
    --cw-surface:          #f9fafb;
    --cw-surface-alt:      #f3f4f6;
    --cw-border:           #e8e8e8;
    --cw-border-input:     #d1d5db;
    --cw-text:             #111111;
    --cw-text-muted:       #6b7280;
    --cw-text-label:       #374151;
    --cw-text-heading:     #0a0a0a;
    --cw-text-placeholder: #9ca3af;
    --cw-primary:          #2563eb;
    --cw-primary-hover:    #1d4ed8;
    --cw-primary-surface:  #eff6ff;
    --cw-primary-text:     #ffffff;
    --cw-primary-glow:     #bfdbfe;
    --cw-cta-bg:           #0a0a0a;
    --cw-cta-hover:        #1f1f1f;
    --cw-submit-bg:        #0a0a0a;
    --cw-submit-hover:     #1f1f1f;
    --cw-success-bg:       #d1fae5;
    --cw-spinner:          #2563eb;
    --cw-branding:         #d1d5db;
    --cw-lang-active-bg:   #0a0a0a;
    --cw-lang-active-text: #ffffff;
    --cw-radius:           14px;
    --cw-radius-sm:        8px;
    --cw-radius-btn:       999px;

    font-family: var(--cw-font);
    font-size: 14px;
    line-height: 1.55;
    color: var(--cw-text);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .cw-root {
    background: var(--cw-bg);
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius);
    max-width: 720px;
    margin: 0 auto;
    position: relative;
  }

  /* ── Image ─────────────────────────────────────── */
  .cw-visual {
    width: 100%;
    aspect-ratio: 16/9;
    background: var(--cw-surface-alt);
    overflow: hidden;
    position: relative;
    border-top-left-radius: var(--cw-radius);
    border-top-right-radius: var(--cw-radius);
  }
  .cw-visual img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cw-visual model-viewer {
    width: 100%;
    height: 100%;
    background: transparent;
  }
  .cw-ar-btn {
    position: absolute;
    bottom: 14px;
    right: 14px;
    background: rgba(10,10,10,0.72);
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .cw-ar-btn:hover { background: rgba(10,10,10,0.88); }
  .cw-anim-controls {
    position: absolute;
    bottom: 14px;
    left: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cw-anim-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(10,10,10,0.72);
    color: #fff;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .cw-anim-btn:hover { background: rgba(10,10,10,0.88); }
  .cw-anim-btn-active { background: var(--cw-accent, #2563eb); }
  .cw-anim-btn-active:hover { background: var(--cw-accent, #2563eb); filter: brightness(1.1); }
  .cw-anim-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 110px;
    height: 4px;
    border-radius: 999px;
    background: rgba(255,255,255,0.35);
    outline: none;
    cursor: pointer;
  }
  .cw-anim-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: pointer;
  }
  .cw-anim-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: pointer;
  }
  .cw-anim-select {
    background: rgba(10,10,10,0.72);
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 6px 26px 6px 12px;
    font-size: 11px;
    font-family: var(--cw-font);
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    max-width: 160px;
  }
  .cw-anim-select option { color: #111; background: #fff; }
  .cw-ar-hint {
    position: absolute;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10,10,10,0.55);
    color: #fff;
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .cw-visual-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cw-text-placeholder);
    font-family: var(--cw-font-display);
    font-size: 14px;
    letter-spacing: 0.02em;
  }

  /* ── Body ───────────────────────────────────────── */
  .cw-body { padding: 24px 24px 18px; }

  .cw-product-name {
    font-family: var(--cw-font-display);
    font-size: 26px;
    font-weight: 500;
    line-height: 1.18;
    letter-spacing: -0.012em;
    color: var(--cw-text-heading);
    margin-bottom: 6px;
  }
  .cw-product-desc {
    color: var(--cw-text-muted);
    font-size: 14px;
    line-height: 1.55;
    margin-bottom: 24px;
    max-width: 56ch;
  }

  /* ── Characteristic tabs ────────────────────────── */
  .cw-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--cw-border);
  }
  .cw-tab {
    appearance: none;
    border: 1px solid var(--cw-border);
    background: var(--cw-bg);
    color: var(--cw-text-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding: 7px 14px;
    border-radius: var(--cw-radius-btn);
    cursor: pointer;
    transition: background .12s, color .12s, border-color .12s;
  }
  .cw-tab:hover { color: var(--cw-text-heading); border-color: var(--cw-text-heading); }
  .cw-tab--active {
    background: var(--cw-text-heading);
    border-color: var(--cw-text-heading);
    color: var(--cw-primary-text);
  }
  .cw-tab--active:hover { color: var(--cw-primary-text); }

  /* ── Characteristics ────────────────────────────── */
  .cw-characteristics { display: flex; flex-direction: column; gap: 16px; }

  .cw-char-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--cw-text-muted);
    margin-bottom: 8px;
  }

  /* Select */
  .cw-select {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    background: var(--cw-bg);
    font-size: 14px;
    font-family: var(--cw-font);
    color: var(--cw-text);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.6'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
    transition: border-color 0.15s;
  }
  .cw-select:hover { border-color: var(--cw-text); }
  .cw-select:focus { outline: none; border-color: var(--cw-text); box-shadow: 0 0 0 3px var(--cw-surface-alt); }
  .cw-select:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Pill buttons (radio + toggle share style) */
  .cw-radio-group, .cw-toggle-group { display: flex; flex-wrap: wrap; gap: 6px; }
  .cw-radio-btn, .cw-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 13px;
    border: 1px solid var(--cw-border);
    border-radius: 999px;
    font-size: 13px;
    font-family: var(--cw-font);
    cursor: pointer;
    background: var(--cw-bg);
    color: var(--cw-text);
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    user-select: none;
    line-height: 1.4;
    white-space: normal;
    word-break: break-word;
    text-align: left;
  }
  .cw-radio-btn:hover:not(.disabled),
  .cw-toggle-btn:hover:not(.disabled) { border-color: var(--cw-text-heading); }
  .cw-radio-btn.selected,
  .cw-toggle-btn.selected {
    background: var(--cw-text-heading);
    border-color: var(--cw-text-heading);
    color: #ffffff;
    font-weight: 500;
  }
  .cw-radio-btn.selected .cw-modifier,
  .cw-toggle-btn.selected .cw-modifier { color: rgba(255,255,255,0.72); }
  .cw-radio-btn.disabled,
  .cw-toggle-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    text-decoration: line-through;
  }

  /* Boolean (single checkbox) */
  .cw-checkbox-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-family: var(--cw-font);
    font-size: 14px;
    color: var(--cw-text);
    user-select: none;
  }
  .cw-checkbox-row.disabled { opacity: 0.5; cursor: not-allowed; }
  .cw-checkbox {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: inherit;
    accent-color: var(--cw-text-heading);
  }
  .cw-checkbox-label { line-height: 1.4; }

  /* Swatch — tile cards */
  .cw-swatch-group {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
  .cw-swatch {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    background: var(--cw-bg);
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
    text-align: left;
    font-family: var(--cw-font);
  }
  .cw-swatch-tile {
    width: 100%;
    aspect-ratio: 1/1;
    background: var(--cw-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cw-text-muted);
    font-family: var(--cw-font-display);
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .cw-swatch-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cw-swatch-meta {
    padding: 7px 9px 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    border-top: 1px solid var(--cw-border);
    background: var(--cw-bg);
  }
  .cw-swatch-label {
    font-size: 12px;
    color: var(--cw-text);
    line-height: 1.3;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  .cw-swatch-color {
    background-size: cover;
    position: relative;
  }
  .cw-swatch-color::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
    pointer-events: none;
  }
  .cw-swatch-mod {
    font-size: 10px;
    color: var(--cw-text-muted);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
  .cw-swatch-mod.positive { color: #047857; }
  .cw-swatch-mod.negative { color: #b91c1c; }
  .cw-swatch:hover:not(.disabled) { border-color: var(--cw-text-heading); }
  .cw-swatch.selected {
    border-color: var(--cw-text-heading);
    box-shadow: inset 0 0 0 1px var(--cw-text-heading);
  }
  .cw-swatch.selected .cw-swatch-meta { background: var(--cw-text-heading); }
  .cw-swatch.selected .cw-swatch-label { color: #ffffff; }
  .cw-swatch.selected .cw-swatch-mod { color: rgba(255,255,255,0.72); }
  .cw-swatch.disabled { opacity: 0.35; cursor: not-allowed; }

  /* Price modifier hint (inside pills) */
  .cw-modifier {
    font-size: 11px;
    color: var(--cw-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .cw-modifier.positive { color: #047857; }
  .cw-modifier.negative { color: #b91c1c; }

  /* Number input */
  .cw-number-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
    font-family: var(--cw-font);
    color: var(--cw-text);
    background: var(--cw-bg);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cw-number-input:hover { border-color: var(--cw-text); }
  .cw-number-input:focus { outline: none; border-color: var(--cw-text); box-shadow: 0 0 0 3px var(--cw-surface-alt); }
  .cw-number-input.locked { background: var(--cw-surface); color: var(--cw-text-muted); cursor: not-allowed; }
  .cw-number-input.error { border-color: #dc2626; }
  .cw-number-input.error:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12); }
  .cw-number-error { margin-top: 4px; font-size: 12px; color: #dc2626; }

  /* Text input (multi-line) */
  .cw-textarea {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
    font-family: var(--cw-font);
    color: var(--cw-text);
    background: var(--cw-bg);
    resize: vertical;
    line-height: 1.4;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cw-textarea:hover { border-color: var(--cw-text); }
  .cw-textarea:focus { outline: none; border-color: var(--cw-text); box-shadow: 0 0 0 3px var(--cw-surface-alt); }
  .cw-textarea.error { border-color: #dc2626; }
  .cw-textarea.error:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12); }
  .cw-char-counter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    font-size: 11px;
    color: var(--cw-text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* ── Neon text preview (migration 096) ──────────────────────────────────────
     The dark panel + layered text-shadow glow. The tube colour comes from the
     inline --cw-neon-glow custom property set per-render by NeonPreview, so the
     glow updates live without re-injecting CSS. All scoped to the shadow root. */
  .cw-neon-panel {
    position: relative;
    background: #0c0c12;
    background-image: radial-gradient(120% 100% at 50% 0%, #16161f 0%, #0a0a0f 70%);
    border: 1px solid #1f1f29;
    border-radius: var(--cw-radius-sm);
    padding: 28px 18px;
    margin-bottom: 10px;
    min-height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  /* Background scene: an absolutely-filled layer behind the glow text. The
     text (a sibling that follows in source order) sits above it. */
  .cw-neon-scene {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;
  }
  .cw-neon-text {
    --cw-neon-glow: #ff2d95;
    position: relative;
    z-index: 1;
    font-size: 34px;
    line-height: 1.25;
    text-align: center;
    word-break: break-word;
    color: #fff5fb;
    /* White-ish inner core + increasing-blur halos in the tube colour. */
    text-shadow:
      0 0 2px #ffffff,
      0 0 6px var(--cw-neon-glow),
      0 0 12px var(--cw-neon-glow),
      0 0 24px var(--cw-neon-glow),
      0 0 42px var(--cw-neon-glow);
  }
  .cw-neon-text--placeholder { opacity: 0.45; }

  /* Hero variant: the neon glow takes the place of the product image/3D at the
     top of the widget. Fills the width, matches the visual's rounded top, and
     overrides the inline panel's compact framing with a taller hero canvas. */
  .cw-neon-hero {
    width: 100%;
    border-top-left-radius: var(--cw-radius);
    border-top-right-radius: var(--cw-radius);
    overflow: hidden;
  }
  .cw-neon-hero .cw-neon-panel {
    border: none;
    border-radius: 0;
    margin-bottom: 0;
    min-height: 0;
    aspect-ratio: 16/9;
    padding: 32px 24px;
  }
  .cw-neon-hero .cw-neon-text { font-size: 42px; }

  /* Per-character colouring: each letter is its own clickable glowing span. */
  .cw-neon-text--perchar { cursor: default; }
  .cw-neon-char {
    cursor: pointer;
    color: #fff5fb;
    transition: transform 0.08s;
    text-shadow:
      0 0 2px #ffffff,
      0 0 6px var(--cw-neon-glow),
      0 0 12px var(--cw-neon-glow),
      0 0 24px var(--cw-neon-glow),
      0 0 42px var(--cw-neon-glow);
  }
  .cw-neon-char:hover { transform: translateY(-2px); }
  .cw-neon-char.selected {
    outline: 2px dashed rgba(255,255,255,0.6);
    outline-offset: 3px;
    border-radius: 3px;
  }
  .cw-neon-space { white-space: pre; }

  /* Painter: the swatch row shown under the hero in per-character mode. */
  .cw-neon-painter {
    background: #0c0c12;
    padding: 0 18px 16px;
    text-align: center;
  }
  .cw-neon-painter-hint {
    color: #9aa;
    font-size: 11px;
    letter-spacing: 0.02em;
    margin-bottom: 10px;
  }
  .cw-neon-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .cw-neon-swatch {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.25);
    cursor: pointer;
    padding: 0;
    transition: transform 0.08s, border-color 0.12s;
  }
  .cw-neon-swatch:hover:not(:disabled) { transform: scale(1.12); border-color: rgba(255,255,255,0.7); }
  .cw-neon-swatch:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Background-scene picker: thumbnail row under the hero. Each thumb shows the
     scene art; the label rides along the bottom for clarity. */
  .cw-neon-scenes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    background: #0c0c12;
    padding: 0 16px 16px;
  }
  .cw-neon-scene-btn {
    position: relative;
    width: 88px;
    height: 50px;
    border-radius: var(--cw-radius-sm);
    border: 2px solid rgba(255,255,255,0.2);
    background: #0a0a0f center / cover no-repeat;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    transition: transform 0.08s, border-color 0.12s;
  }
  .cw-neon-scene-btn:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.55); }
  .cw-neon-scene-btn.selected { border-color: #fff; }
  .cw-neon-scene-name {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 4px;
    font-size: 9px;
    line-height: 1.2;
    color: #fff;
    background: rgba(0,0,0,0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cw-neon-fonts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .cw-neon-font-btn {
    padding: 6px 12px;
    font-size: 15px;
    line-height: 1.1;
    border: 1px solid var(--cw-border-input);
    border-radius: var(--cw-radius-sm);
    background: var(--cw-bg);
    color: var(--cw-text);
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
  }
  .cw-neon-font-btn:hover { border-color: var(--cw-text); }
  .cw-neon-font-btn.selected {
    border-color: var(--cw-text);
    background: var(--cw-surface-alt);
  }

  /* Colour picker */
  .cw-color-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cw-color-input {
    width: 44px;
    height: 36px;
    padding: 2px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    background: var(--cw-bg);
    cursor: pointer;
  }
  .cw-color-input:hover { border-color: var(--cw-text); }
  .cw-color-hex {
    font-size: 13px;
    font-family: var(--cw-font);
    color: var(--cw-text);
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
  }
  .cw-color-placeholder {
    font-size: 13px;
    font-family: var(--cw-font);
    color: var(--cw-text-muted);
  }

  /* Locked value display */
  .cw-locked-value {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--cw-surface);
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
  }
  .cw-locked-label { font-weight: 500; color: var(--cw-text-label); }
  .cw-locked-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--cw-text-muted);
    background: var(--cw-bg);
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid var(--cw-border);
  }
  /* "Included" — rule-driven price waive on a locked value. Reads as a benefit,
     so positive accent colour rather than the muted look of "Auto-set". */
  .cw-included-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #047857;
    background: #ecfdf5;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid #a7f3d0;
  }

  /* ── Price breakdown ──────────────────────────────── */
  .cw-price-breakdown {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid var(--cw-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cw-breakdown-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--cw-text-muted);
    margin-bottom: 6px;
  }
  .cw-breakdown-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    padding: 2px 0;
  }
  .cw-breakdown-label {
    color: var(--cw-text-muted);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cw-breakdown-amount {
    color: var(--cw-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cw-breakdown-amount.positive { color: var(--cw-text); }
  .cw-breakdown-amount.negative { color: #b91c1c; }

  /* ── Sticky bar ───────────────────────────────── */
  .cw-bar {
    position: sticky;
    bottom: 0;
    background: rgba(255,255,255,0.94);
    backdrop-filter: blur(14px) saturate(1.1);
    -webkit-backdrop-filter: blur(14px) saturate(1.1);
    border-top: 1px solid var(--cw-border);
    padding: 11px 18px 13px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 1;
    border-bottom-left-radius: var(--cw-radius);
    border-bottom-right-radius: var(--cw-radius);
  }
  .cw-bar-chips {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
    scrollbar-width: thin;
    -ms-overflow-style: none;
  }
  .cw-bar-chips::-webkit-scrollbar { height: 3px; }
  .cw-bar-chips::-webkit-scrollbar-track { background: transparent; }
  .cw-bar-chips::-webkit-scrollbar-thumb { background: var(--cw-border); border-radius: 2px; }
  .cw-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    background: var(--cw-surface);
    border: 1px solid var(--cw-border);
    border-radius: 999px;
    font-size: 11px;
    color: var(--cw-text);
    white-space: nowrap;
    flex: 0 0 auto;
    line-height: 1.4;
  }
  .cw-chip-key {
    font-weight: 600;
    color: var(--cw-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9px;
  }
  .cw-chip-val { color: var(--cw-text); }

  .cw-bar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .cw-bar-price {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }
  .cw-bar-price-label {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--cw-text-muted);
    line-height: 1;
    margin-bottom: 2px;
  }
  .cw-bar-price-value {
    font-family: var(--cw-font-display);
    font-size: 22px;
    font-weight: 500;
    line-height: 1.1;
    color: var(--cw-text-heading);
    letter-spacing: -0.012em;
    font-variant-numeric: tabular-nums;
  }
  .cw-bar-price-currency {
    font-family: var(--cw-font);
    font-size: 12px;
    font-weight: 400;
    color: var(--cw-text-muted);
    margin-left: 5px;
    letter-spacing: 0.02em;
  }
  .cw-bar-cta {
    padding: 10px 18px;
    background: var(--cw-cta-bg);
    color: #ffffff;
    border: none;
    border-radius: 999px;
    font-family: var(--cw-font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: background 0.15s, transform 0.05s;
    white-space: nowrap;
    flex: 0 0 auto;
  }
  .cw-bar-cta:hover:not(:disabled) { background: var(--cw-cta-hover); }
  .cw-bar-cta:active:not(:disabled) { transform: translateY(1px); }
  .cw-bar-cta:disabled { background: var(--cw-surface-alt); color: var(--cw-text-placeholder); cursor: not-allowed; }
  .cw-bar-price-disclaimer {
    margin: 8px 0 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--cw-text-muted);
  }
  @media (max-width: 480px) {
    .cw-bar-row { flex-direction: column; align-items: stretch; gap: 10px; }
    .cw-bar-cta { text-align: center; }
  }

  /* ── Inquiry form ───────────────────────────────── */
  .cw-inquiry-form {
    margin-top: 24px;
    padding-top: 22px;
    border-top: 1px solid var(--cw-border);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cw-inquiry-title {
    font-family: var(--cw-font-display);
    font-size: 18px;
    font-weight: 500;
    color: var(--cw-text-heading);
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }

  .cw-field { display: flex; flex-direction: column; gap: 5px; }
  .cw-field label {
    font-size: 10px;
    font-weight: 600;
    color: var(--cw-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .cw-field input,
  .cw-field textarea {
    padding: 9px 12px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
    font-family: var(--cw-font);
    resize: vertical;
    background: var(--cw-bg);
    color: var(--cw-text);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cw-field input:hover,
  .cw-field textarea:hover { border-color: var(--cw-text); }
  .cw-field input:focus,
  .cw-field textarea:focus {
    outline: none;
    border-color: var(--cw-text);
    box-shadow: 0 0 0 3px var(--cw-surface-alt);
  }
  .cw-field-error { font-size: 11px; color: #b91c1c; }
  .cw-field-hint {
    font-size: 11px;
    line-height: 1.4;
    color: var(--cw-text-muted);
    text-transform: none;
    letter-spacing: 0;
  }
  .cw-field input[type="file"] {
    padding: 7px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .cw-file-list {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cw-file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    background: var(--cw-surface-alt);
    font-size: 13px;
  }
  .cw-file-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--cw-text);
  }
  .cw-file-size {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--cw-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .cw-file-remove {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    line-height: 18px;
    text-align: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--cw-text-muted);
    font-size: 16px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .cw-file-remove:hover { background: var(--cw-border); color: var(--cw-text); }

  .cw-submit-btn {
    margin-top: 4px;
    padding: 11px 18px;
    background: var(--cw-submit-bg);
    color: #fff;
    border: none;
    border-radius: 999px;
    font-size: 13px;
    font-family: var(--cw-font);
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cw-submit-btn:hover:not(:disabled) { background: var(--cw-submit-hover); }
  .cw-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  /* ── States ─────────────────────────────────────── */
  .cw-loading {
    padding: 56px 24px;
    text-align: center;
    color: var(--cw-text-placeholder);
    font-size: 13px;
    font-family: var(--cw-font-display);
    letter-spacing: 0.02em;
  }
  .cw-spinner {
    width: 26px; height: 26px;
    border: 1.5px solid var(--cw-border);
    border-top-color: var(--cw-spinner);
    border-radius: 50%;
    animation: cw-spin 0.75s linear infinite;
    margin: 0 auto 14px;
  }
  @keyframes cw-spin { to { transform: rotate(360deg); } }

  .cw-error {
    padding: 28px 24px;
    text-align: center;
    color: #b91c1c;
    font-size: 13px;
  }

  .cw-success {
    padding: 56px 24px 40px;
    text-align: center;
  }
  .cw-success-icon {
    width: 52px; height: 52px;
    background: var(--cw-success-bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px;
    font-size: 24px;
  }
  .cw-success h3 {
    font-family: var(--cw-font-display);
    font-size: 22px;
    font-weight: 500;
    color: var(--cw-text-heading);
    margin-bottom: 8px;
    letter-spacing: -0.012em;
  }
  .cw-success p  {
    font-size: 14px;
    color: var(--cw-text-muted);
    max-width: 44ch;
    margin: 0 auto;
    line-height: 1.55;
  }

  /* ── Branding ────────────────────────────────────── */
  .cw-branding {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 10px;
    color: var(--cw-branding);
    padding: 10px 0 6px;
    letter-spacing: 0.02em;
  }
  .cw-branding a { color: var(--cw-branding); text-decoration: none; }
  .cw-branding a:hover { color: var(--cw-text-muted); }
  /* When the tenant has remove_branding turned on we still render the
     language switcher so customers can change locale. */
  .cw-branding--lang-only { justify-content: flex-end; padding: 6px 0; }

  /* ── Language switcher ───────────────────────────── */
  .cw-lang-switcher { display: flex; gap: 2px; }
  .cw-lang-btn {
    font-size: 9px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid var(--cw-border);
    background: transparent;
    color: var(--cw-text-placeholder);
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.05em;
  }
  .cw-lang-btn:hover { color: var(--cw-text-muted); border-color: var(--cw-border-input); }
  .cw-lang-btn--active {
    background: var(--cw-lang-active-bg);
    color: var(--cw-lang-active-text);
    border-color: var(--cw-lang-active-bg);
  }
  .cw-lang-btn--disabled {
    opacity: 0.45;
    cursor: default;
    border-style: dashed;
  }
  .cw-lang-btn--disabled:hover {
    color: var(--cw-text-placeholder);
    border-color: var(--cw-border);
  }
  .cw-lang-divider {
    width: 1px;
    align-self: stretch;
    margin: 0 2px;
    background: var(--cw-border);
  }

  /* Dimension lines overlay for 3D model viewer */
  .cw-dim-overlay {
    position: absolute; inset: 0;
    pointer-events: none; overflow: visible;
  }
  .cw-dim-overlay line {
    stroke: rgba(0,0,0,0.40); stroke-width: 1.5px;
  }
  .cw-dim-overlay text {
    fill: rgba(0,0,0,0.55);
    font-size: 11px; font-family: var(--cw-font);
    text-anchor: middle; dominant-baseline: auto;
  }
`
