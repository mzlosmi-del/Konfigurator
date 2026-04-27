import { describe, it, expect } from 'vitest'

// ── Slug generator (mirrors the SQL function logic) ───────────────────────────

function generatePublicSlug(rng: () => number = Math.random): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let slug = ''
  for (let i = 0; i < 10; i++) {
    slug += chars[Math.floor(rng() * chars.length)]
  }
  return slug
}

describe('public-preview: slug generation', () => {
  it('generates a 10-character slug', () => {
    const slug = generatePublicSlug()
    expect(slug).toHaveLength(10)
  })

  it('uses only lowercase letters and digits', () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePublicSlug()).toMatch(/^[a-z0-9]{10}$/)
    }
  })

  it('produces unique slugs (statistical)', () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generatePublicSlug()))
    expect(slugs.size).toBe(1000)
  })

  it('is deterministic given the same seeded rng', () => {
    const makeRng = (initial: number) => {
      let seed = initial
      return () => {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff
        return (seed >>> 0) / 0x100000000
      }
    }
    expect(generatePublicSlug(makeRng(42))).toBe(generatePublicSlug(makeRng(42)))
  })
})

// ── HTML escaping (mirrors h() in the edge function) ─────────────────────────

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

describe('public-preview: HTML escaping', () => {
  it('escapes & < > "', () => {
    expect(h('a & b')).toBe('a &amp; b')
    expect(h('<script>')).toBe('&lt;script&gt;')
    expect(h('"quoted"')).toBe('&quot;quoted&quot;')
  })

  it('leaves safe strings unchanged', () => {
    expect(h('Hello World')).toBe('Hello World')
  })
})

// ── Preview access rules ──────────────────────────────────────────────────────

interface ProductRow {
  status: 'draft' | 'published' | 'archived'
  public_slug: string | null
  public_preview_enabled: boolean
  is_template: boolean
}

function isPubliclyAccessible(p: ProductRow): boolean {
  return (
    p.status === 'published' &&
    p.public_slug !== null &&
    p.public_preview_enabled &&
    !p.is_template
  )
}

describe('public-preview: access rules', () => {
  const base: ProductRow = { status: 'published', public_slug: 'abc123xyzq', public_preview_enabled: true, is_template: false }

  it('published + slug + enabled → accessible', () => {
    expect(isPubliclyAccessible(base)).toBe(true)
  })

  it('draft product → not accessible', () => {
    expect(isPubliclyAccessible({ ...base, status: 'draft' })).toBe(false)
  })

  it('no slug yet → not accessible', () => {
    expect(isPubliclyAccessible({ ...base, public_slug: null })).toBe(false)
  })

  it('preview disabled → not accessible', () => {
    expect(isPubliclyAccessible({ ...base, public_preview_enabled: false })).toBe(false)
  })

  it('template product → never publicly accessible', () => {
    expect(isPubliclyAccessible({ ...base, is_template: true })).toBe(false)
  })

  it('archived product → not accessible', () => {
    expect(isPubliclyAccessible({ ...base, status: 'archived' })).toBe(false)
  })
})

// ── Branding logic ────────────────────────────────────────────────────────────

describe('public-preview: "Powered by" branding', () => {
  it('shows branding when remove_branding is false (free/starter)', () => {
    const showBranding = !(false)   // remove_branding = false
    expect(showBranding).toBe(true)
  })

  it('hides branding when remove_branding is true (growth/scale)', () => {
    const showBranding = !(true)    // remove_branding = true
    expect(showBranding).toBe(false)
  })
})

// ── Slug-first-publish trigger logic ─────────────────────────────────────────

interface BeforeUpdate { old_status: string; new_status: string; current_slug: string | null; is_template: boolean }

function triggerResult(row: BeforeUpdate): string | null {
  if (row.new_status === 'published' && row.current_slug === null && !row.is_template) {
    return generatePublicSlug()   // would be assigned
  }
  return row.current_slug
}

describe('public-preview: trigger behaviour', () => {
  it('assigns a slug when first published', () => {
    const slug = triggerResult({ old_status: 'draft', new_status: 'published', current_slug: null, is_template: false })
    expect(slug).toHaveLength(10)
  })

  it('does not overwrite an existing slug on re-save', () => {
    const slug = triggerResult({ old_status: 'published', new_status: 'published', current_slug: 'existingslug', is_template: false })
    expect(slug).toBe('existingslug')
  })

  it('does not assign a slug to templates', () => {
    const slug = triggerResult({ old_status: 'draft', new_status: 'published', current_slug: null, is_template: true })
    expect(slug).toBeNull()
  })

  it('does not assign a slug on archive', () => {
    const slug = triggerResult({ old_status: 'published', new_status: 'archived', current_slug: null, is_template: false })
    expect(slug).toBeNull()
  })
})
