export type ThemeId = 'cloud' | 'forest' | 'slate' | 'sand'

export const THEME_IDS: ThemeId[] = ['cloud', 'forest', 'slate', 'sand']

export interface ThemeMeta {
  label:   string
  font:    string        // CSS font-family snippet for preview
  colors:  string[]     // [bg, primary, cta/submit] hex values for swatches
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  cloud: {
    label:  'Cloud',
    font:   'system-ui, sans-serif',
    colors: ['#ffffff', '#2563eb', '#111827'],
  },
  forest: {
    label:  'Forest',
    font:   "Georgia, serif",
    colors: ['#f9fdfb', '#059669', '#065f46'],
  },
  slate: {
    label:  'Slate',
    font:   "'Helvetica Neue', Arial, sans-serif",
    colors: ['#f8fafc', '#6366f1', '#4338ca'],
  },
  sand: {
    label:  'Sand',
    font:   "Palatino, Georgia, serif",
    colors: ['#fffbf7', '#b45309', '#78350f'],
  },
}

// CSS custom property overrides injected into :host for each theme.
// Cloud is the default (variables defined in styles.ts), so its entry
// is present but could be omitted; keeping it explicit makes all themes
// self-contained for reference.
export const THEME_VARS: Record<ThemeId, Record<string, string>> = {
  cloud: {
    '--cw-font':             'system-ui,-apple-system,sans-serif',
    '--cw-bg':               '#ffffff',
    '--cw-surface':          '#f9fafb',
    '--cw-surface-alt':      '#f3f4f6',
    '--cw-border':           '#e5e7eb',
    '--cw-border-input':     '#d1d5db',
    '--cw-text':             '#1a1a1a',
    '--cw-text-muted':       '#6b7280',
    '--cw-text-label':       '#374151',
    '--cw-text-heading':     '#111827',
    '--cw-text-placeholder': '#9ca3af',
    '--cw-primary':          '#2563eb',
    '--cw-primary-hover':    '#1d4ed8',
    '--cw-primary-surface':  '#eff6ff',
    '--cw-primary-text':     '#1d4ed8',
    '--cw-primary-glow':     '#bfdbfe',
    '--cw-cta-bg':           '#2563eb',
    '--cw-cta-hover':        '#1d4ed8',
    '--cw-submit-bg':        '#111827',
    '--cw-submit-hover':     '#374151',
    '--cw-success-bg':       '#d1fae5',
    '--cw-spinner':          '#2563eb',
    '--cw-branding':         '#d1d5db',
    '--cw-lang-active-bg':   '#111827',
    '--cw-lang-active-text': '#ffffff',
    '--cw-radius':           '12px',
    '--cw-radius-sm':        '6px',
    '--cw-radius-btn':       '8px',
  },

  forest: {
    '--cw-font':             "Georgia,'Times New Roman',serif",
    '--cw-bg':               '#f9fdfb',
    '--cw-surface':          '#ecfdf5',
    '--cw-surface-alt':      '#d1fae5',
    '--cw-border':           '#a7f3d0',
    '--cw-border-input':     '#6ee7b7',
    '--cw-text':             '#0f2d1e',
    '--cw-text-muted':       '#4b7a5e',
    '--cw-text-label':       '#065f46',
    '--cw-text-heading':     '#064e3b',
    '--cw-text-placeholder': '#6ee7b7',
    '--cw-primary':          '#059669',
    '--cw-primary-hover':    '#047857',
    '--cw-primary-surface':  '#ecfdf5',
    '--cw-primary-text':     '#065f46',
    '--cw-primary-glow':     '#6ee7b7',
    '--cw-cta-bg':           '#059669',
    '--cw-cta-hover':        '#047857',
    '--cw-submit-bg':        '#065f46',
    '--cw-submit-hover':     '#064e3b',
    '--cw-success-bg':       '#bbf7d0',
    '--cw-spinner':          '#059669',
    '--cw-branding':         '#6ee7b7',
    '--cw-lang-active-bg':   '#065f46',
    '--cw-lang-active-text': '#ecfdf5',
    '--cw-radius':           '8px',
    '--cw-radius-sm':        '4px',
    '--cw-radius-btn':       '6px',
  },

  slate: {
    '--cw-font':             "'Helvetica Neue',Arial,sans-serif",
    '--cw-bg':               '#f8fafc',
    '--cw-surface':          '#f1f5f9',
    '--cw-surface-alt':      '#e2e8f0',
    '--cw-border':           '#e2e8f0',
    '--cw-border-input':     '#cbd5e1',
    '--cw-text':             '#0f172a',
    '--cw-text-muted':       '#64748b',
    '--cw-text-label':       '#334155',
    '--cw-text-heading':     '#0f172a',
    '--cw-text-placeholder': '#94a3b8',
    '--cw-primary':          '#6366f1',
    '--cw-primary-hover':    '#4f46e5',
    '--cw-primary-surface':  '#eef2ff',
    '--cw-primary-text':     '#4338ca',
    '--cw-primary-glow':     '#c7d2fe',
    '--cw-cta-bg':           '#6366f1',
    '--cw-cta-hover':        '#4f46e5',
    '--cw-submit-bg':        '#4338ca',
    '--cw-submit-hover':     '#3730a3',
    '--cw-success-bg':       '#e0e7ff',
    '--cw-spinner':          '#6366f1',
    '--cw-branding':         '#e2e8f0',
    '--cw-lang-active-bg':   '#4338ca',
    '--cw-lang-active-text': '#f0f4ff',
    '--cw-radius':           '6px',
    '--cw-radius-sm':        '4px',
    '--cw-radius-btn':       '6px',
  },

  sand: {
    '--cw-font':             "Palatino,'Palatino Linotype','Book Antiqua',Georgia,serif",
    '--cw-bg':               '#fffbf7',
    '--cw-surface':          '#fef6e4',
    '--cw-surface-alt':      '#fde68a',
    '--cw-border':           '#e7d5b3',
    '--cw-border-input':     '#d6bc8b',
    '--cw-text':             '#1c1917',
    '--cw-text-muted':       '#78716c',
    '--cw-text-label':       '#57534e',
    '--cw-text-heading':     '#1c1917',
    '--cw-text-placeholder': '#a8a29e',
    '--cw-primary':          '#b45309',
    '--cw-primary-hover':    '#92400e',
    '--cw-primary-surface':  '#fef3c7',
    '--cw-primary-text':     '#92400e',
    '--cw-primary-glow':     '#fcd34d',
    '--cw-cta-bg':           '#b45309',
    '--cw-cta-hover':        '#92400e',
    '--cw-submit-bg':        '#78350f',
    '--cw-submit-hover':     '#451a03',
    '--cw-success-bg':       '#fef9c3',
    '--cw-spinner':          '#d97706',
    '--cw-branding':         '#e7d5b3',
    '--cw-lang-active-bg':   '#78350f',
    '--cw-lang-active-text': '#fffbf7',
    '--cw-radius':           '4px',
    '--cw-radius-sm':        '2px',
    '--cw-radius-btn':       '4px',
  },
}

export function themeToStyleBlock(id: string): string {
  const vars = THEME_VARS[id as ThemeId] ?? THEME_VARS.cloud
  return `:host{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`
}
