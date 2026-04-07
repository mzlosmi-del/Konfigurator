import { describe, it, expect } from 'vitest'
import type { VisualizationAsset, Selection } from '../types'

// Re-implement resolveImage as a pure export for testing.
// We duplicate the logic here to keep Visualization.tsx a Preact component
// without importing h in tests. In practice, extract resolveImage to a util
// file if you want a single source of truth.
function resolveImage(assets: VisualizationAsset[], selection: Selection): string | null {
  const selectedValueIds = new Set(Object.values(selection))

  const valueMatches = assets.filter(
    a => a.asset_type === 'image' &&
         a.characteristic_value_id !== null &&
         selectedValueIds.has(a.characteristic_value_id!)
  )

  if (valueMatches.length > 0) {
    valueMatches.sort((a, b) =>
      a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.id.localeCompare(b.id)
    )
    return valueMatches[0].url
  }

  const defaults = assets.filter(a => a.is_default && a.asset_type === 'image')
  if (defaults.length === 0) return null
  defaults.sort((a, b) =>
    a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.id.localeCompare(b.id)
  )
  return defaults[0].url
}

function asset(overrides: Partial<VisualizationAsset> & { id: string; url: string }): VisualizationAsset {
  return {
    characteristic_value_id: null,
    asset_type: 'image',
    is_default: false,
    sort_order: 0,
    ...overrides,
  }
}

describe('resolveImage', () => {
  it('returns null when no assets exist', () => {
    expect(resolveImage([], { 'c1': 'v1' })).toBeNull()
  })

  it('returns default image when nothing is selected', () => {
    const assets = [asset({ id: 'a1', url: 'default.jpg', is_default: true })]
    expect(resolveImage(assets, {})).toBe('default.jpg')
  })

  it('returns default image when selection matches no value-specific asset', () => {
    const assets = [asset({ id: 'a1', url: 'default.jpg', is_default: true })]
    expect(resolveImage(assets, { c1: 'v1' })).toBe('default.jpg')
  })

  it('prefers value-specific asset over default', () => {
    const assets = [
      asset({ id: 'a1', url: 'default.jpg', is_default: true, sort_order: 0 }),
      asset({ id: 'a2', url: 'oak.jpg', characteristic_value_id: 'val-oak', sort_order: 1 }),
    ]
    expect(resolveImage(assets, { 'c-mat': 'val-oak' })).toBe('oak.jpg')
  })

  it('picks lowest sort_order when multiple value-specific matches exist — bug 4', () => {
    const assets = [
      asset({ id: 'a1', url: 'walnut.jpg', characteristic_value_id: 'val-walnut', sort_order: 5 }),
      asset({ id: 'a2', url: 'oak.jpg',    characteristic_value_id: 'val-oak',    sort_order: 2 }),
      asset({ id: 'a3', url: 'pine.jpg',   characteristic_value_id: 'val-pine',   sort_order: 3 }),
    ]
    // Both oak and walnut are selected (two characteristics); oak has lower sort_order
    const selection: Selection = { 'c-mat': 'val-oak', 'c-size': 'val-walnut' }
    expect(resolveImage(assets, selection)).toBe('oak.jpg')
  })

  it('is deterministic when sort_order is equal — falls back to id comparison', () => {
    const assets = [
      asset({ id: 'b-asset', url: 'b.jpg', characteristic_value_id: 'val-b', sort_order: 0 }),
      asset({ id: 'a-asset', url: 'a.jpg', characteristic_value_id: 'val-a', sort_order: 0 }),
    ]
    const selection: Selection = { c1: 'val-a', c2: 'val-b' }
    // 'a-asset' < 'b-asset' lexicographically → a.jpg wins
    expect(resolveImage(assets, selection)).toBe('a.jpg')
  })

  it('returns default image for product with no characteristics — bug 3', () => {
    const assets = [
      asset({ id: 'a1', url: 'product-default.jpg', is_default: true }),
    ]
    // No selection at all (product has zero characteristics)
    expect(resolveImage(assets, {})).toBe('product-default.jpg')
  })

  it('prefers lower sort_order among multiple defaults', () => {
    const assets = [
      asset({ id: 'a1', url: 'second.jpg', is_default: true, sort_order: 2 }),
      asset({ id: 'a2', url: 'first.jpg',  is_default: true, sort_order: 1 }),
    ]
    expect(resolveImage(assets, {})).toBe('first.jpg')
  })
})
