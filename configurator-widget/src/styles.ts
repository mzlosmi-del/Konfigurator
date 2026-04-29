export const WIDGET_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1a1a1a;
  }

  .cw-root {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    max-width: 680px;
  }

  /* ── Image ─────────────────────────────────────── */
  .cw-visual {
    width: 100%;
    aspect-ratio: 16/9;
    background: #f3f4f6;
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
  .cw-visual-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    font-size: 13px;
  }

  /* ── Body ───────────────────────────────────────── */
  .cw-body { padding: 20px 24px; }

  .cw-product-name {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .cw-product-desc {
    color: #6b7280;
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
    color: #374151;
    margin-bottom: 8px;
  }

  /* Select */
  .cw-select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
    font-size: 14px;
    color: #1a1a1a;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }
  .cw-select:focus { outline: 2px solid #2563eb; outline-offset: 1px; }
  .cw-select:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Radio */
  .cw-radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .cw-radio-btn {
    padding: 6px 14px;
    border: 1.5px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    background: #fff;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }
  .cw-radio-btn:hover:not(.disabled) { border-color: #2563eb; }
  .cw-radio-btn.selected {
    border-color: #2563eb;
    background: #eff6ff;
    color: #1d4ed8;
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
    border: 2px solid #e5e7eb;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
    background: #f9fafb;
    transition: border-color 0.15s, transform 0.1s;
    overflow: hidden;
  }
  .cw-swatch:hover:not(.disabled) { transform: scale(1.1); border-color: #2563eb; }
  .cw-swatch.selected { border-color: #2563eb; box-shadow: 0 0 0 2px #bfdbfe; }
  .cw-swatch.disabled { opacity: 0.35; cursor: not-allowed; }
  .cw-swatch img { width: 100%; height: 100%; object-fit: cover; }

  /* Toggle */
  .cw-toggle-group { display: flex; gap: 8px; }
  .cw-toggle-btn {
    padding: 7px 16px;
    border: 1.5px solid #d1d5db;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    background: #fff;
    transition: all 0.15s;
  }
  .cw-toggle-btn.selected {
    border-color: #2563eb;
    background: #2563eb;
    color: #fff;
    font-weight: 500;
  }
  .cw-toggle-btn.disabled { opacity: 0.4; cursor: not-allowed; }

  /* Price modifier hint */
  .cw-modifier {
    font-size: 11px;
    color: #6b7280;
    margin-left: 4px;
  }
  .cw-modifier.positive { color: #059669; }
  .cw-modifier.negative { color: #dc2626; }

  /* Number input */
  .cw-number-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    color: #1a1a1a;
    background: #fff;
  }
  .cw-number-input:focus { outline: 2px solid #2563eb; outline-offset: 1px; }
  .cw-number-input.locked { background: #f9fafb; color: #6b7280; cursor: not-allowed; }

  /* Locked value display */
  .cw-locked-value {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
  }
  .cw-locked-label { font-weight: 500; color: #374151; }
  .cw-locked-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    background: #e5e7eb;
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
  .cw-price-label { font-size: 13px; color: #6b7280; }
  .cw-price-value { font-size: 22px; font-weight: 700; color: #111827; }
  .cw-price-currency { font-size: 14px; font-weight: 400; color: #6b7280; margin-left: 4px; }

  /* ── Inquiry form ───────────────────────────────── */
  .cw-form-toggle {
    margin-top: 16px;
    width: 100%;
    padding: 10px;
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cw-form-toggle:hover { background: #1d4ed8; }

  .cw-inquiry-form {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #f3f4f6;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cw-inquiry-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .cw-field { display: flex; flex-direction: column; gap: 4px; }
  .cw-field label { font-size: 12px; font-weight: 500; color: #374151; }
  .cw-field input,
  .cw-field textarea {
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    background: #fff;
    color: #1a1a1a;
  }
  .cw-field input:focus,
  .cw-field textarea:focus {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }
  .cw-field-error { font-size: 11px; color: #dc2626; }

  .cw-submit-btn {
    padding: 10px;
    background: #111827;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cw-submit-btn:hover { background: #374151; }
  .cw-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── States ─────────────────────────────────────── */
  .cw-loading {
    padding: 48px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
  }
  .cw-spinner {
    width: 28px; height: 28px;
    border: 2px solid #e5e7eb;
    border-top-color: #2563eb;
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
    background: #d1fae5;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    font-size: 22px;
  }
  .cw-success h3 { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
  .cw-success p { font-size: 13px; color: #6b7280; }

  /* ── Branding ────────────────────────────────────── */
  .cw-branding {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    color: #d1d5db;
    padding: 10px 0 4px;
  }
  .cw-branding a { color: #d1d5db; text-decoration: none; }
  .cw-branding a:hover { color: #9ca3af; }

  /* ── Language switcher ───────────────────────────── */
  .cw-lang-switcher {
    display: flex;
    gap: 2px;
  }
  .cw-lang-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cw-lang-btn:hover { color: #6b7280; border-color: #d1d5db; }
  .cw-lang-btn--active {
    background: #111827;
    color: #fff;
    border-color: #111827;
  }
`
