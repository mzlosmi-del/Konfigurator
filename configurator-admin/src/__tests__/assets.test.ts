import { describe, it, expect } from 'vitest'
import type { VisualizationAsset } from '../types/database'

// ── Pure resolution logic tests (no Supabase, no network) ───────────────────
//
// These mirror the widget's resolveImage but exercise the data model
// from the admin side. They verify the sort_order / is_default contract
// that the admin UI is responsible for maintaining.

function makeAsset(
  overrides: Partial<VisualizationAsset> & { id: string; url: string }
): VisualizationAsset {
  return {
    tenant_id: 'tenant-1',
    product_id: 'product-1',
    characteristic_value_id: null,
    asset_type: 'image',
    is_default: false,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// Replicates the resolution contract the admin must preserve.
// Widget's resolveImage is the authority — this validates the same contract
// from data the admin writes.
function resolveForDisplay(
  assets: VisualizationAsset[],
  selectedValueIds: Set<string>
): string | null {
  const displayable = (a: VisualizationAsset) =>
    a.asset_type === 'image' || a.asset_type === 'render'

  const stable = (arr: VisualizationAsset[]) =>
    [...arr].sort((a, b) =>
      a.sort_order !== b.sort_order
        ? a.sort_order - b.sort_order
        : a.id.localeCompare(b.id)
    )

  const valueMatches = assets.filter(
    a => displayable(a) &&
         a.characteristic_value_id !== null &&
         selectedValueIds.has(a.characteristic_value_id!)
  )
  if (valueMatches.length > 0) return stable(valueMatches)[0].url

  const defaults = assets.filter(a => displayable(a) && a.is_default)
  if (defaults.length > 0) return stable(defaults)[0].url

  return null
}

// ── Asset CRUD contract ───────────────────────────────────────────────────────

describe('asset data model contract', () => {
  it('default asset has no characteristic_value_id', () => {
    const a = makeAsset({ id: 'a1', url: 'default.jpg', is_default: true })
    expect(a.characteristic_value_id).toBeNull()
    expect(a.is_default).toBe(true)
  })

  it('value-attached asset has a characteristic_value_id', () => {
    const a = makeAsset({
      id: 'a1',
      url: 'oak.jpg',
      characteristic_value_id: 'val-oak',
      is_default: false,
    })
    expect(a.characteristic_value_id).toBe('val-oak')
  })

  it('asset types are constrained to image, render, 3d_model', () => {
    const validTypes: VisualizationAsset['asset_type'][] = ['image', 'render', '3d_model']
    const asset = makeAsset({ id: 'a1', url: 'x.jpg', asset_type: 'image' })
    expect(validTypes).toContain(asset.asset_type)
  })

  it('sort_order determines display priority — lower wins', () => {
    const a1 = makeAsset({ id: 'a1', url: 'high-priority.jpg', is_default: true, sort_order: 0 })
    const a2 = makeAsset({ id: 'a2', url: 'low-priority.jpg',  is_default: true, sort_order: 1 })
    const url = resolveForDisplay([a2, a1], new Set())
    expect(url).toBe('high-priority.jpg')
  })
})

// ── Resolution: default fallback ─────────────────────────────────────────────

describe('default asset fallback', () => {
  it('returns default when no selection — default fallback', () => {
    const assets = [makeAsset({ id: 'a1', url: 'default.jpg', is_default: true })]
    expect(resolveForDisplay(assets, new Set())).toBe('default.jpg')
  })

  it('returns default when selection has no matching value asset', () => {
    const assets = [makeAsset({ id: 'a1', url: 'default.jpg', is_default: true })]
    expect(resolveForDisplay(assets, new Set(['val-missing']))).toBe('default.jpg')
  })

  it('returns null when no assets at all', () => {
    expect(resolveForDisplay([], new Set())).toBeNull()
  })

  it('returns null when only a 3d_model asset exists', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'model.glb', is_default: true, asset_type: '3d_model' }),
    ]
    expect(resolveForDisplay(assets, new Set())).toBeNull()
  })
})

// ── Resolution: exact match beats default ────────────────────────────────────

describe('exact match beats default', () => {
  it('value-specific asset wins over default', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'default.jpg', is_default: true, sort_order: 0 }),
      makeAsset({ id: 'a2', url: 'oak.jpg', characteristic_value_id: 'val-oak', sort_order: 1 }),
    ]
    expect(resolveForDisplay(assets, new Set(['val-oak']))).toBe('oak.jpg')
  })

  it('value match wins even when default has lower sort_order', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'default.jpg', is_default: true, sort_order: 0 }),
      makeAsset({ id: 'a2', url: 'oak.jpg', characteristic_value_id: 'val-oak', sort_order: 99 }),
    ]
    expect(resolveForDisplay(assets, new Set(['val-oak']))).toBe('oak.jpg')
  })
})

// ── Resolution: deterministic sort_order tie-break ───────────────────────────

describe('deterministic sort_order tie-break', () => {
  it('lower sort_order wins among multiple value matches', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'walnut.jpg', characteristic_value_id: 'val-walnut', sort_order: 5 }),
      makeAsset({ id: 'a2', url: 'oak.jpg',    characteristic_value_id: 'val-oak',    sort_order: 2 }),
    ]
    expect(resolveForDisplay(assets, new Set(['val-walnut', 'val-oak']))).toBe('oak.jpg')
  })

  it('id tiebreaks when sort_order is equal', () => {
    const assets = [
      makeAsset({ id: 'z-id', url: 'z.jpg', characteristic_value_id: 'val-z', sort_order: 0 }),
      makeAsset({ id: 'a-id', url: 'a.jpg', characteristic_value_id: 'val-a', sort_order: 0 }),
    ]
    expect(resolveForDisplay(assets, new Set(['val-z', 'val-a']))).toBe('a.jpg')
  })

  it('lower sort_order wins among multiple defaults', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'second.jpg', is_default: true, sort_order: 2 }),
      makeAsset({ id: 'a2', url: 'first.jpg',  is_default: true, sort_order: 1 }),
    ]
    expect(resolveForDisplay(assets, new Set())).toBe('first.jpg')
  })
})

// ── Resolution: render type ───────────────────────────────────────────────────

describe('render asset type', () => {
  it('render type is resolved like image', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'render.jpg', characteristic_value_id: 'val-x', asset_type: 'render' }),
    ]
    expect(resolveForDisplay(assets, new Set(['val-x']))).toBe('render.jpg')
  })

  it('render default fallback works', () => {
    const assets = [
      makeAsset({ id: 'a1', url: 'render-default.jpg', is_default: true, asset_type: 'render' }),
    ]
    expect(resolveForDisplay(assets, new Set())).toBe('render-default.jpg')
  })
})
