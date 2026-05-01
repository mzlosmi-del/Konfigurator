export const WIDGET_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    /* ── Theme defaults (Cloud) — overridden per-theme via themeToStyleBlock() ── */
    --cw-font:             system-ui,-apple-system,sans-serif;
    --cw-bg:               #ffffff;
    --cw-surface:          #f9fafb;
    --cw-surface-alt:      #f3f4f6;
    --cw-border:           #e5e7eb;
    --cw-border-input:     #d1d5db;
    --cw-text:             #1a1a1a;
    --cw-text-muted:       #6b7280;
    --cw-text-label:       #374151;
    --cw-text-heading:     #111827;
    --cw-text-placeholder: #9ca3af;
    --cw-primary:          #2563eb;
    --cw-primary-hover:    #1d4ed8;
    --cw-primary-surface:  #eff6ff;
    --cw-primary-text:     #1d4ed8;
    --cw-primary-glow:     #bfdbfe;
    --cw-cta-bg:           #2563eb;
    --cw-cta-hover:        #1d4ed8;
    --cw-submit-bg:        #111827;
    --cw-submit-hover:     #374151;
    --cw-success-bg:       #d1fae5;
    --cw-spinner:          #2563eb;
    --cw-branding:         #d1d5db;
    --cw-lang-active-bg:   #111827;
    --cw-lang-active-text: #ffffff;
    --cw-radius:           12px;
    --cw-radius-sm:        6px;
    --cw-radius-btn:       8px;

    font-family: var(--cw-font);
    font-size: 14px;
    line-height: 1.5;
    color: var(--cw-text);
  }

  .cw-root {
    background: var(--cw-bg);
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius);
    overflow: hidden;
    max-width: 680px;
  }

  /* ── Image ─────────────────────────────────────── */
  .cw-visual {
    width: 100%;
    aspect-ratio: 16/9;
    background: var(--cw-surface-alt);
    overflow: hidden;
    position: relative;
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
    bottom: 16px;
    right: 16px;
    background: rgba(0,0,0,0.70);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    letter-spacing: 0.01em;
  }
  .cw-ar-btn:hover {
    background: rgba(0,0,0,0.85);
  }
  .cw-ar-hint {
    position: absolute;
    bottom: 56px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.55);
    color: #fff;
    border-radius: 6px;
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
    font-size: 13px;
  }

  /* ── Body ───────────────────────────────────────── */
  .cw-body { padding: 20px 24px; }

  .cw-product-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--cw-text-heading);
    margin-bottom: 4px;
  }
  .cw-product-desc {
    color: var(--cw-text-muted);
    font-size: 13px;
    margin-bottom: 20px;
  }

  /* ── Characteristics ────────────────────────────── */
  .cw-characteristics { display: flex; flex-direction: column; gap: 18px; }

  .cw-char-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cw-text-label);
    margin-bottom: 8px;
  }

  /* Select */
  .cw-select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--cw-border-input);
    border-radius: var(--cw-radius-sm);
    background: var(--cw-bg);
    font-size: 14px;
    font-family: var(--cw-font);
    color: var(--cw-text);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }
  .cw-select:focus { outline: 2px solid var(--cw-primary); outline-offset: 1px; }
  .cw-select:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Radio */
  .cw-radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .cw-radio-btn {
    padding: 6px 14px;
    border: 1.5px solid var(--cw-border-input);
    border-radius: var(--cw-radius-sm);
    font-size: 13px;
    font-family: var(--cw-font);
    cursor: pointer;
    background: var(--cw-bg);
    color: var(--cw-text);
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }
  .cw-radio-btn:hover:not(.disabled) { border-color: var(--cw-primary); }
  .cw-radio-btn.selected {
    border-color: var(--cw-primary);
    background: var(--cw-primary-surface);
    color: var(--cw-primary-text);
    font-weight: 500;
  }
  .cw-radio-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    text-decoration: line-through;
  }

  /* Swatch */
  .cw-swatch-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .cw-swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--cw-border);
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
    background: var(--cw-surface);
    transition: border-color 0.15s, transform 0.1s;
    overflow: hidden;
  }
  .cw-swatch:hover:not(.disabled) { transform: scale(1.1); border-color: var(--cw-primary); }
  .cw-swatch.selected { border-color: var(--cw-primary); box-shadow: 0 0 0 2px var(--cw-primary-glow); }
  .cw-swatch.disabled { opacity: 0.35; cursor: not-allowed; }
  .cw-swatch img { width: 100%; height: 100%; object-fit: cover; }

  /* Toggle */
  .cw-toggle-group { display: flex; gap: 8px; }
  .cw-toggle-btn {
    padding: 7px 16px;
    border: 1.5px solid var(--cw-border-input);
    border-radius: 20px;
    font-size: 13px;
    font-family: var(--cw-font);
    cursor: pointer;
    background: var(--cw-bg);
    color: var(--cw-text);
    transition: all 0.15s;
  }
  .cw-toggle-btn.selected {
    border-color: var(--cw-primary);
    background: var(--cw-primary);
    color: #fff;
    font-weight: 500;
  }
  .cw-toggle-btn.disabled { opacity: 0.4; cursor: not-allowed; }

  /* Price modifier hint */
  .cw-modifier {
    font-size: 11px;
    color: var(--cw-text-muted);
    margin-left: 4px;
  }
  .cw-modifier.positive { color: #059669; }
  .cw-modifier.negative { color: #dc2626; }

  /* Number input */
  .cw-number-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--cw-border-input);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
    font-family: var(--cw-font);
    color: var(--cw-text);
    background: var(--cw-bg);
  }
  .cw-number-input:focus { outline: 2px solid var(--cw-primary); outline-offset: 1px; }
  .cw-number-input.locked { background: var(--cw-surface); color: var(--cw-text-muted); cursor: not-allowed; }

  /* Locked value display */
  .cw-locked-value {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--cw-surface);
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
  }
  .cw-locked-label { font-weight: 500; color: var(--cw-text-label); }
  .cw-locked-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cw-text-muted);
    background: var(--cw-border);
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* ── Price breakdown ──────────────────────────────── */
  .cw-price-breakdown {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--cw-surface-alt);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cw-breakdown-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cw-text-muted);
    margin-bottom: 4px;
  }
  .cw-breakdown-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
  }
  .cw-breakdown-label {
    color: var(--cw-text-label);
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
  .cw-breakdown-amount.positive { color: #059669; }
  .cw-breakdown-amount.negative { color: #dc2626; }

  /* ── Price bar ──────────────────────────────────── */
  .cw-price-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--cw-surface-alt);
  }
  .cw-price-label { font-size: 13px; color: var(--cw-text-muted); }
  .cw-price-value { font-size: 22px; font-weight: 700; color: var(--cw-text-heading); }
  .cw-price-currency { font-size: 14px; font-weight: 400; color: var(--cw-text-muted); margin-left: 4px; }

  /* ── Inquiry form ───────────────────────────────── */
  .cw-form-toggle {
    margin-top: 16px;
    width: 100%;
    padding: 10px;
    background: var(--cw-cta-bg);
    color: #fff;
    border: none;
    border-radius: var(--cw-radius-btn);
    font-size: 14px;
    font-family: var(--cw-font);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cw-form-toggle:hover { background: var(--cw-cta-hover); }
  .cw-form-toggle:disabled { opacity: 0.5; cursor: not-allowed; }

  .cw-inquiry-form {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--cw-surface-alt);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cw-inquiry-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--cw-text-heading);
    margin-bottom: 4px;
  }

  .cw-field { display: flex; flex-direction: column; gap: 4px; }
  .cw-field label { font-size: 12px; font-weight: 500; color: var(--cw-text-label); }
  .cw-field input,
  .cw-field textarea {
    padding: 8px 10px;
    border: 1px solid var(--cw-border-input);
    border-radius: var(--cw-radius-sm);
    font-size: 14px;
    font-family: var(--cw-font);
    resize: vertical;
    background: var(--cw-bg);
    color: var(--cw-text);
  }
  .cw-field input:focus,
  .cw-field textarea:focus {
    outline: 2px solid var(--cw-primary);
    outline-offset: 1px;
  }
  .cw-field-error { font-size: 11px; color: #dc2626; }

  .cw-submit-btn {
    padding: 10px;
    background: var(--cw-submit-bg);
    color: #fff;
    border: none;
    border-radius: var(--cw-radius-btn);
    font-size: 14px;
    font-family: var(--cw-font);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cw-submit-btn:hover { background: var(--cw-submit-hover); }
  .cw-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── States ─────────────────────────────────────── */
  .cw-loading {
    padding: 48px;
    text-align: center;
    color: var(--cw-text-placeholder);
    font-size: 13px;
  }
  .cw-spinner {
    width: 28px; height: 28px;
    border: 2px solid var(--cw-border);
    border-top-color: var(--cw-spinner);
    border-radius: 50%;
    animation: cw-spin 0.7s linear infinite;
    margin: 0 auto 12px;
  }
  @keyframes cw-spin { to { transform: rotate(360deg); } }

  .cw-error {
    padding: 24px;
    text-align: center;
    color: #dc2626;
    font-size: 13px;
  }

  .cw-success {
    padding: 40px 24px;
    text-align: center;
  }
  .cw-success-icon {
    width: 48px; height: 48px;
    background: var(--cw-success-bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    font-size: 22px;
  }
  .cw-success h3 { font-size: 16px; font-weight: 600; color: var(--cw-text-heading); margin-bottom: 6px; }
  .cw-success p  { font-size: 13px; color: var(--cw-text-muted); }

  /* ── Branding ────────────────────────────────────── */
  .cw-branding {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    color: var(--cw-branding);
    padding: 10px 0 4px;
  }
  .cw-branding a { color: var(--cw-branding); text-decoration: none; }
  .cw-branding a:hover { color: var(--cw-text-muted); }

  /* ── Language switcher ───────────────────────────── */
  .cw-lang-switcher { display: flex; gap: 2px; }
  .cw-lang-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--cw-border);
    background: transparent;
    color: var(--cw-text-placeholder);
    cursor: pointer;
    transition: all 0.15s;
  }
  .cw-lang-btn:hover { color: var(--cw-text-muted); border-color: var(--cw-border-input); }
  .cw-lang-btn--active {
    background: var(--cw-lang-active-bg);
    color: var(--cw-lang-active-text);
    border-color: var(--cw-lang-active-bg);
  }
`
