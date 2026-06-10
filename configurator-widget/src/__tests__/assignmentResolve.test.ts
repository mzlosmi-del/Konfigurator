import { describe, it, expect } from 'vitest'
import { resolveImage } from '../resolveImage'
import type { VisualizationAsset, VisualizationAssignment, Selection, NumericInputs } from '../types'

function asset(id: string, url: string): VisualizationAsset {
  return { id, url, characteristic_value_id: null, asset_type: 'image', is_default: false, sort_order: 0, mesh_rules: [] }
}
function row(
  id: string,
  asset_id: string,
  priority: number,
  conditions: VisualizationAssignment['conditions'],
): VisualizationAssignment {
  return { id, asset_id, priority, conditions }
}
const sel = (s: Selection): Selection => s
const num = (n: NumericInputs): NumericInputs => n

const assets = [asset('img-wood', 'wood.png'), asset('img-red', 'red.png'), asset('img-wide', 'wide.png'), asset('img-fallback', 'fallback.png')]

describe('resolveImage assignment table', () => {
  it('single select condition matches', () => {
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows)).toBe('red.png')
  })

  it('multi-condition AND requires every cell to match', () => {
    const rows = [row('r1', 'img-wood', 1, [
      { characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null },
      { characteristic_id: 'c-mat',   operator: 'eq', value_id: 'v-wood', numeric_value: null },
    ])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red', 'c-mat': 'v-wood' }), rows)).toBe('wood.png')
    expect(resolveImage(assets, sel({ 'c-color': 'v-red', 'c-mat': 'v-steel' }), rows)).toBeNull()
  })

  it('empty (absent) condition is a wildcard', () => {
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red', 'c-mat': 'v-anything' }), rows)).toBe('red.png')
  })

  it('all-wildcard row is a catch-all', () => {
    const rows = [row('r1', 'img-fallback', 1, [])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-anything' }), rows)).toBe('fallback.png')
  })

  it('numeric gt / lt / eq', () => {
    const gt = [row('r1', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'gt', value_id: null, numeric_value: 2000 }])]
    expect(resolveImage(assets, sel({}), gt, num({ 'c-w': 2500 }))).toBe('wide.png')
    expect(resolveImage(assets, sel({}), gt, num({ 'c-w': 1500 }))).toBeNull()

    const lt = [row('r1', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'lt', value_id: null, numeric_value: 2000 }])]
    expect(resolveImage(assets, sel({}), lt, num({ 'c-w': 1500 }))).toBe('wide.png')

    const eq = [row('r1', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'eq', value_id: null, numeric_value: 2000 }])]
    expect(resolveImage(assets, sel({}), eq, num({ 'c-w': 2000 }))).toBe('wide.png')
    expect(resolveImage(assets, sel({}), eq, num({ 'c-w': 2001 }))).toBeNull()
  })

  it('lower priority wins', () => {
    const rows = [
      row('r2', 'img-red',  2, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
      row('r1', 'img-wood', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
    ]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows)).toBe('wood.png')
  })

  it('id tiebreak when priority is equal', () => {
    const rows = [
      row('b-row', 'img-red',  1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
      row('a-row', 'img-wood', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
    ]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows)).toBe('wood.png')
  })

  it('unmade choice on a conditioned characteristic does not match', () => {
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(assets, sel({}), rows)).toBeNull()
    const numRow = [row('r2', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'gt', value_id: null, numeric_value: 10 }])]
    expect(resolveImage(assets, sel({}), numRow, num({}))).toBeNull()
  })

  it('no row matches -> falls back to is_default', () => {
    const fallbackAssets = [...assets, { ...asset('def', 'is-default.png'), is_default: true }]
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(fallbackAssets, sel({ 'c-color': 'v-blue' }), rows)).toBe('is-default.png')
  })

  it('row asset_id pointing at a missing asset is skipped', () => {
    const rows = [row('r1', 'img-DOES-NOT-EXIST', 1, [])]
    expect(resolveImage(assets, sel({}), rows)).toBeNull()
  })

  it('legacy 2-arg call still works (no assignments)', () => {
    const legacy = [{ ...asset('a', 'oak.png'), characteristic_value_id: 'v-oak' }]
    expect(resolveImage(legacy, sel({ 'c-mat': 'v-oak' }))).toBe('oak.png')
  })

  it('mixed numeric + select conditions in one row (AND)', () => {
    const rows = [row('r1', 'img-wide', 1, [
      { characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null },
      { characteristic_id: 'c-w',     operator: 'gt', value_id: null,    numeric_value: 2000 },
    ])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows, num({ 'c-w': 2500 }))).toBe('wide.png')
    // select matches but numeric fails -> no match
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows, num({ 'c-w': 1500 }))).toBeNull()
    // numeric matches but select fails -> no match
    expect(resolveImage(assets, sel({ 'c-color': 'v-blue' }), rows, num({ 'c-w': 2500 }))).toBeNull()
  })

  it('skips a non-matching higher-priority row and matches a lower-priority one', () => {
    const rows = [
      row('r1', 'img-red',  1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red',  numeric_value: null }]),
      row('r2', 'img-wood', 2, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-blue', numeric_value: null }]),
    ]
    // selection matches only the lower-priority (priority 2) row
    expect(resolveImage(assets, sel({ 'c-color': 'v-blue' }), rows)).toBe('wood.png')
  })
})
