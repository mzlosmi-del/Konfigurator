export type EventType =
  | 'view'
  | 'characteristic_changed'
  | 'inquiry_started'
  | 'inquiry_submitted'

interface QueuedEvent {
  session_id: string
  event_type: EventType
  payload:    Record<string, unknown>
}

export function createAnalytics(opts: {
  supabaseUrl: string
  productId:   string
  tenantId:    string
}) {
  // Honour Do Not Track
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
    return { track: (_t: EventType) => {} }
  }

  // Stable session ID (survives page navigation, cleared on tab close)
  const sessionId = (() => {
    const KEY = 'cw_sid'
    try {
      let sid = sessionStorage.getItem(KEY)
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(KEY, sid) }
      return sid
    } catch { return crypto.randomUUID() }
  })()

  const endpoint = `${opts.supabaseUrl.replace(/\/$/, '')}/functions/v1/ingest-events`
  const queue: QueuedEvent[] = []

  function flush() {
    if (queue.length === 0) return
    const events = queue.splice(0)
    const body   = JSON.stringify({ product_id: opts.productId, tenant_id: opts.tenantId, events })
    // keepalive: true survives page unload; credentials: 'omit' is required so
    // the browser doesn't send cookies — wildcard CORS rejects credentialed requests
    fetch(endpoint, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      body,
      keepalive:   true,
      credentials: 'omit',
    }).catch(() => {})
  }

  // Debounce characteristic_changed so rapid clicks produce one event per burst
  let charDebounceTimer: ReturnType<typeof setTimeout> | null = null

  function track(type: EventType, payload: Record<string, unknown> = {}) {
    if (type === 'characteristic_changed') {
      if (charDebounceTimer !== null) clearTimeout(charDebounceTimer)
      charDebounceTimer = setTimeout(() => {
        charDebounceTimer = null
        queue.push({ session_id: sessionId, event_type: type, payload })
        if (queue.length >= 5) flush()
      }, 400)
      return
    }
    queue.push({ session_id: sessionId, event_type: type, payload })
    if (queue.length >= 5) flush()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }

  return { track }
}
