import { h, render } from 'preact'
import { Widget } from './components/Widget'
import { WIDGET_STYLES } from './styles'
import type { WidgetConfig } from './types'

const MOUNT_ATTR = 'data-cw-mounted'

function mountWidget(el: HTMLElement) {
  if (el.hasAttribute(MOUNT_ATTR)) return
  el.setAttribute(MOUNT_ATTR, '1')

  const supabaseUrl    = el.getAttribute('data-supabase-url')    ?? ''
  const supabaseAnonKey = el.getAttribute('data-supabase-anon-key') ?? ''
  const productId      = el.getAttribute('data-product-id')      ?? ''
  const tenantId       = el.getAttribute('data-tenant-id')       ?? ''

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

  // Mount into Shadow DOM — fully isolated from host page styles
  const shadow = el.attachShadow({ mode: 'open' })

  // Inject styles into shadow root
  const styleEl = document.createElement('style')
  styleEl.textContent = WIDGET_STYLES
  shadow.appendChild(styleEl)

  // Mount point inside shadow
  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  render(h(Widget, { config }), mountPoint)
}

function init() {
  // Mount all existing elements on page load
  document.querySelectorAll<HTMLElement>('[data-product-id][data-tenant-id]').forEach(mountWidget)
}

// Run on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

declare const __WIDGET_VERSION__: string

// Also expose manual mount and version for SPAs that render after script load
;(window as Window & { ConfiguratorWidget?: { mount: (el: HTMLElement) => void; version: string } }).ConfiguratorWidget = {
  mount: mountWidget,
  version: __WIDGET_VERSION__,
}
