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
