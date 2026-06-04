import { describe, it, expect } from 'vitest'
import { applyCharacteristicOrder, type CharOrderRow } from '../charOrder'

describe('applyCharacteristicOrder', () => {
  const base = ['a', 'b', 'c', 'd']

  it('returns the input unchanged when there are no overrides', () => {
    expect(applyCharacteristicOrder(base, [])).toEqual(base)
  })

  it('returns the input unchanged when overrides match no present id', () => {
    const overrides: CharOrderRow[] = [{ characteristic_id: 'zzz', sort_order: 0 }]
    expect(applyCharacteristicOrder(base, overrides)).toEqual(base)
  })

  it('orders overridden ids first by sort_order, rest keep relative order', () => {
    const overrides: CharOrderRow[] = [
      { characteristic_id: 'd', sort_order: 0 },
      { characteristic_id: 'b', sort_order: 1 },
    ]
    // d, b explicitly first (by sort_order); a, c follow in original order.
    expect(applyCharacteristicOrder(base, overrides)).toEqual(['d', 'b', 'a', 'c'])
  })

  it('fully reorders when every id has an override', () => {
    const overrides: CharOrderRow[] = [
      { characteristic_id: 'c', sort_order: 0 },
      { characteristic_id: 'a', sort_order: 1 },
      { characteristic_id: 'd', sort_order: 2 },
      { characteristic_id: 'b', sort_order: 3 },
    ]
    expect(applyCharacteristicOrder(base, overrides)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('ignores stale override rows for ids no longer present', () => {
    const overrides: CharOrderRow[] = [
      { characteristic_id: 'c', sort_order: 0 },
      { characteristic_id: 'gone', sort_order: 1 },
    ]
    expect(applyCharacteristicOrder(base, overrides)).toEqual(['c', 'a', 'b', 'd'])
  })
})
