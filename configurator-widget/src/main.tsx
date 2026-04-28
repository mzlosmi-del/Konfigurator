import { h, render } from 'preact'
import { Widget } from './components/Widget'
import { WIDGET_STYLES } from './styles'
import { themeToStyleBlock } from './themes'
import { createAnalytics } from './analytics'
import type { WidgetConfig } from './types'

const MOUNT_ATTR = 'data-cw-mounted'

function mountWidget(el: HTMLElement) {
  if (el.hasAttribute(MOUNT_ATTR)) return
  el.setAttribute(MOUNT_ATTR, '1')

  const supabaseUrl     = el.getAttribute('data-supabase-url')     ?? ''
  const supabaseAnonKey = el.getAttribute('data-supabase-anon-key') ?? ''
  const productId       = el.getAttribute('data-product-id')       ?? ''
  const tenantId        = el.getAttribute('data-tenant-id')        ?? ''

  if (!supabaseUrl || !supabaseAnonKey || !productId || !tenantId) {
    console.warn('[Configurator Widget] Missing required data attributes:', {
      'data-supabase-url': supabaseUrl,
      'data-supabase-anon-key': supabaseAnonKey ? '(set)' : '(missing)',
      'data-product-id': productId,
      'data-tenant-id': tenantId,
    })
    return
  }

  const config: WidgetConfig = { supabaseUrl, supabaseAnonKey, productId, tenantId }
  const { track } = createAnalytics({ supabaseUrl, productId, tenantId })

  // Mount into Shadow DOM — fully isolated from host page styles
  const shadow = el.attachShadow({ mode: 'open' })

  // Theme variables (injected first so they're available to WIDGET_STYLES)
  const themeEl = document.createElement('style')
  themeEl.textContent = themeToStyleBlock(el.getAttribute('data-style') ?? 'cloud')
  shadow.appendChild(themeEl)

  const styleEl = document.createElement('style')
  styleEl.textContent = WIDGET_STYLES
  shadow.appendChild(styleEl)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  render(h(Widget, { config, track }), mountPoint)

  // View event fires once per mount
  track('view')
}

function init() {
  document.querySelectorAll<HTMLElement>('[data-product-id][data-tenant-id]').forEach(mountWidget)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

declare const __WIDGET_VERSION__: string

;(window as Window & { ConfiguratorWidget?: { mount: (el: HTMLElement) => void; version: string } }).ConfiguratorWidget = {
  mount: mountWidget,
  version: __WIDGET_VERSION__,
}

// ── Web Component ──────────────────────────────────────────────────────────────
// Allows usage as: <konfigurator-widget data-product-id="…" data-tenant-id="…" …>
if (typeof customElements !== 'undefined' && !customElements.get('konfigurator-widget')) {
  class KonfiguratorWidget extends HTMLElement {
    connectedCallback() { mountWidget(this) }
  }
  customElements.define('konfigurator-widget', KonfiguratorWidget)
}
