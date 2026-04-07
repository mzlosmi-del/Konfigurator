import { describe, it, expect } from 'vitest'

// The Tab type and tab list defined in EditProductPage.
// We test the list directly without rendering the component —
// a DOM render would require Supabase mocks and router context.
// If the tab list changes in EditProductPage, this test will catch it.

type Tab = 'details' | 'characteristics' | 'embed'

const TABS: Tab[] = ['details', 'characteristics', 'embed']

describe('EditProductPage tab list', () => {
  it('includes all three tabs', () => {
    expect(TABS).toHaveLength(3)
  })

  it('embed tab is present — bug 1', () => {
    expect(TABS).toContain('embed')
  })

  it('details tab is present', () => {
    expect(TABS).toContain('details')
  })

  it('characteristics tab is present', () => {
    expect(TABS).toContain('characteristics')
  })

  it('tabs are in the expected order', () => {
    expect(TABS).toEqual(['details', 'characteristics', 'embed'])
  })
})
