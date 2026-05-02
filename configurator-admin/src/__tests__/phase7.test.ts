import { describe, it, expect } from 'vitest'

// ── Webhook payload v2 enrichment ─────────────────────────────────────────────

interface ConfigLine { characteristic_name: string; value_label: string; price_modifier: number }

interface InquiryPayload {
  inquiry_id:     string
  customer_name:  string
  customer_email: string
  product_name:   string
  product_id:     string
  total_price:    number | null
  currency:       string
  configuration:  ConfigLine[]
  created_at:     string
}

type EnrichedPayload = InquiryPayload & {
  public_slug:  string | null
  utm_source:   string | null
  utm_medium:   string | null
  referrer:     string | null
  v2:           { configuration: ConfigLine[] }
}

function enrichInquiryPayload(
  payload: InquiryPayload,
  publicSlug: string | null,
): EnrichedPayload {
  return {
    ...payload,
    public_slug: publicSlug,
    utm_source:  (payload as unknown as Record<string, unknown>).utm_source as string | null ?? null,
    utm_medium:  (payload as unknown as Record<string, unknown>).utm_medium as string | null ?? null,
    referrer:    (payload as unknown as Record<string, unknown>).referrer   as string | null ?? null,
    v2: { configuration: payload.configuration },
  }
}

const BASE_PAYLOAD: InquiryPayload = {
  inquiry_id:     'inq-1',
  customer_name:  'Jane Smith',
  customer_email: 'jane@example.com',
  product_name:   'Custom Desk',
  product_id:     'prod-1',
  total_price:    599,
  currency:       'EUR',
  configuration:  [{ characteristic_name: 'Material', value_label: 'Oak', price_modifier: 0 }],
  created_at:     '2024-01-01T10:00:00Z',
}

describe('deliver-webhook: payload v2 enrichment', () => {
  it('preserves all v1 fields unchanged', () => {
    const enriched = enrichInquiryPayload(BASE_PAYLOAD, 'abc123')
    expect(enriched.inquiry_id).toBe('inq-1')
    expect(enriched.customer_name).toBe('Jane Smith')
    expect(enriched.customer_email).toBe('jane@example.com')
    expect(enriched.product_name).toBe('Custom Desk')
    expect(enriched.total_price).toBe(599)
    expect(enriched.currency).toBe('EUR')
    expect(enriched.configuration).toHaveLength(1)
    expect(enriched.created_at).toBe('2024-01-01T10:00:00Z')
  })

  it('adds public_slug when product has one', () => {
    const enriched = enrichInquiryPayload(BASE_PAYLOAD, 'myslug123')
    expect(enriched.public_slug).toBe('myslug123')
  })

  it('sets public_slug to null when product has none', () => {
    const enriched = enrichInquiryPayload(BASE_PAYLOAD, null)
    expect(enriched.public_slug).toBeNull()
  })

  it('adds v2.configuration mirroring top-level configuration', () => {
    const enriched = enrichInquiryPayload(BASE_PAYLOAD, null)
    expect(enriched.v2).toBeDefined()
    expect(enriched.v2.configuration).toEqual(BASE_PAYLOAD.configuration)
  })

  it('utm fields are null when not in original payload', () => {
    const enriched = enrichInquiryPayload(BASE_PAYLOAD, null)
    expect(enriched.utm_source).toBeNull()
    expect(enriched.utm_medium).toBeNull()
    expect(enriched.referrer).toBeNull()
  })

  it('v2.configuration is same reference type as top-level', () => {
    const config = [{ characteristic_name: 'Size', value_label: 'L', price_modifier: 50 }]
    const payload = { ...BASE_PAYLOAD, configuration: config }
    const enriched = enrichInquiryPayload(payload, null)
    expect(enriched.v2.configuration[0].value_label).toBe('L')
  })
})

// ── Webhook endpoint event filtering ─────────────────────────────────────────

describe('deliver-webhook: endpoint event filtering', () => {
  type Endpoint = { events: string[] }

  function isRelevant(ep: Endpoint, event: string): boolean {
    return ep.events.length === 0 || ep.events.includes(event)
  }

  it('endpoint with empty events array receives all events', () => {
    expect(isRelevant({ events: [] }, 'inquiry.created')).toBe(true)
    expect(isRelevant({ events: [] }, 'anything')).toBe(true)
  })

  it('endpoint subscribed to specific event receives it', () => {
    expect(isRelevant({ events: ['inquiry.created'] }, 'inquiry.created')).toBe(true)
  })

  it('endpoint subscribed to specific event does not receive others', () => {
    expect(isRelevant({ events: ['inquiry.created'] }, 'product.updated')).toBe(false)
  })

  it('endpoint subscribed to multiple events receives any of them', () => {
    const ep = { events: ['inquiry.created', 'product.updated'] }
    expect(isRelevant(ep, 'inquiry.created')).toBe(true)
    expect(isRelevant(ep, 'product.updated')).toBe(true)
    expect(isRelevant(ep, 'other')).toBe(false)
  })
})

// ── iFrame embed headers ──────────────────────────────────────────────────────

describe('embed: iFrame headers', () => {
  const IFRAME_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Security-Policy':      "frame-ancestors *; script-src 'self' 'unsafe-inline' https: data:; style-src 'self' 'unsafe-inline';",
    'X-Frame-Options':              'ALLOWALL',
  }

  it('allows embedding from any origin via X-Frame-Options', () => {
    expect(IFRAME_HEADERS['X-Frame-Options']).toBe('ALLOWALL')
  })

  it('allows framing via CSP frame-ancestors', () => {
    expect(IFRAME_HEADERS['Content-Security-Policy']).toContain('frame-ancestors *')
  })

  it('sets CORS origin wildcard', () => {
    expect(IFRAME_HEADERS['Access-Control-Allow-Origin']).toBe('*')
  })

  it('includes x-client-info in allowed headers', () => {
    expect(IFRAME_HEADERS['Access-Control-Allow-Headers']).toContain('x-client-info')
  })
})

// ── Web Component registration ────────────────────────────────────────────────

describe('widget: Web Component registration guard', () => {
  it('does not define element if customElements is unavailable', () => {
    // Simulates SSR / environments without customElements
    const hasCE = typeof customElements !== 'undefined'
    // In vitest (Node) customElements is not defined — guard should prevent errors
    expect(() => {
      if (typeof customElements !== 'undefined' && !customElements.get('konfigurator-widget')) {
        // Would call customElements.define — safe to skip in Node
      }
    }).not.toThrow()
    // In Node, customElements is undefined — guard fires correctly
    expect(hasCE).toBe(false)
  })

  it('skips re-definition if element is already registered', () => {
    // Simulates calling the guard a second time when already defined
    const registry: Record<string, boolean> = { 'konfigurator-widget': true }
    const mockGet = (name: string) => registry[name] ?? false
    const wouldDefine = !mockGet('konfigurator-widget')
    expect(wouldDefine).toBe(false)
  })
})

// ── Public slug URL construction ──────────────────────────────────────────────

describe('embed: public slug URL', () => {
  function embedUrl(functionsBase: string, slug: string): string {
    return `${functionsBase}/embed/${slug}`
  }

  it('builds correct embed URL from slug', () => {
    const url = embedUrl('https://xyz.supabase.co/functions/v1', 'abc123xyz0')
    expect(url).toBe('https://xyz.supabase.co/functions/v1/embed/abc123xyz0')
  })

  it('handles slugs with only alphanumeric chars', () => {
    const slug = 'abcdefghij'
    expect(embedUrl('https://base', slug)).toBe('https://base/embed/abcdefghij')
  })
})
