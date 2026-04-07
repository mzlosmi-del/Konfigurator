import { describe, it, expect } from 'vitest'
import { resolveImage } from '../resolveImage'
import type { VisualizationAsset, Selection } from '../types'

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
    expect(resolveImage([], { c1: 'v1' })).toBeNull()
  })

  it('returns default asset when nothing is selected — default fallback', () => {
    const assets = [asset({ id: 'a1', url: 'default.jpg', is_default: true })]
    expect(resolveImage(assets, {})).toBe('default.jpg')
  })

  it('returns default when selection matches no value-specific asset — default fallback', () => {
    const assets = [asset({ id: 'a1', url: 'default.jpg', is_default: true })]
    expect(resolveImage(assets, { c1: 'v1' })).toBe('default.jpg')
  })

  it('exact value match beats default — exact match wins', () => {
    const assets = [
      asset({ id: 'a1', url: 'default.jpg', is_default: true, sort_order: 0 }),
      asset({ id: 'a2', url: 'oak.jpg', characteristic_value_id: 'val-oak', sort_order: 1 }),
    ]
    expect(resolveImage(assets, { 'c-mat': 'val-oak' })).toBe('oak.jpg')
  })

  it('lower sort_order wins among multiple value matches — deterministic tie-break', () => {
    const assets = [
      asset({ id: 'a1', url: 'walnut.jpg', characteristic_value_id: 'val-walnut', sort_order: 5 }),
      asset({ id: 'a2', url: 'oak.jpg',    characteristic_value_id: 'val-oak',    sort_order: 2 }),
      asset({ id: 'a3', url: 'pine.jpg',   characteristic_value_id: 'val-pine',   sort_order: 3 }),
    ]
    const selection: Selection = { 'c-mat': 'val-oak', 'c-size': 'val-walnut' }
    expect(resolveImage(assets, selection)).toBe('oak.jpg')
  })

  it('id tiebreak when sort_order is equal — deterministic', () => {
    const assets = [
      asset({ id: 'b-asset', url: 'b.jpg', characteristic_value_id: 'val-b', sort_order: 0 }),
      asset({ id: 'a-asset', url: 'a.jpg', characteristic_value_id: 'val-a', sort_order: 0 }),
    ]
    expect(resolveImage(assets, { c1: 'val-a', c2: 'val-b' })).toBe('a.jpg')
  })

  it('no assets with no selection returns null', () => {
    expect(resolveImage([], {})).toBeNull()
  })

  it('default asset for product with no characteristics — zero-char product', () => {
    const assets = [asset({ id: 'a1', url: 'product-default.jpg', is_default: true })]
    expect(resolveImage(assets, {})).toBe('product-default.jpg')
  })

  it('lower sort_order wins among multiple defaults', () => {
    const assets = [
      asset({ id: 'a1', url: 'second.jpg', is_default: true, sort_order: 2 }),
      asset({ id: 'a2', url: 'first.jpg',  is_default: true, sort_order: 1 }),
    ]
    expect(resolveImage(assets, {})).toBe('first.jpg')
  })

  it('render assets are resolved like images — render type supported', () => {
    const assets = [
      asset({ id: 'a1', url: 'default.jpg', is_default: true, asset_type: 'image' }),
      asset({ id: 'a2', url: 'render.jpg',  characteristic_value_id: 'val-oak', asset_type: 'render' }),
    ]
    expect(resolveImage(assets, { c1: 'val-oak' })).toBe('render.jpg')
  })

  it('3d_model assets are not resolved — fallback to default image', () => {
    const assets = [
      asset({ id: 'a1', url: 'default.jpg',  is_default: true, asset_type: 'image' }),
      asset({ id: 'a2', url: 'model.glb',    characteristic_value_id: 'val-oak', asset_type: '3d_model' }),
    ]
    // 3d_model should be skipped; fall back to default image
    expect(resolveImage(assets, { c1: 'val-oak' })).toBe('default.jpg')
  })

  it('public reads: assets only for published products are loaded by widget (RLS tested in migration test)', () => {
    // The widget api.ts fetches from Supabase with anon key.
    // RLS policy "visualization_assets: anon reads published products"
    // ensures only assets for published products are returned.
    // This is enforced at the DB level — resolveImage trusts the data it receives.
    // Verify the function itself works correctly given clean data.
    const assets = [asset({ id: 'a1', url: 'pub.jpg', is_default: true })]
    expect(resolveImage(assets, {})).toBe('pub.jpg')
  })
})
