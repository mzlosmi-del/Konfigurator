import { describe, it, expect } from 'vitest'
import {
  buildCharacteristicGroups,
  type ClassMeta,
  type ClassMemberRow,
} from '../charGroups'
import type { CharOrderRow } from '../charOrder'

// Helpers to keep the fixtures terse.
const cls = (id: string, sort_order: number, name = id, name_i18n?: Record<string, string>): ClassMeta =>
  ({ id, sort_order, name, name_i18n })
const mem = (characteristic_id: string, class_id: string, sort_order: number): ClassMemberRow =>
  ({ characteristic_id, class_id, sort_order })

describe('buildCharacteristicGroups', () => {
  it('returns [] for empty classes and members', () => {
    expect(buildCharacteristicGroups([], [], [])).toEqual([])
  })

  it('builds one group with members in member sort_order', () => {
    const groups = buildCharacteristicGroups(
      [cls('C1', 0)],
      [mem('b', 'C1', 1), mem('a', 'C1', 0), mem('c', 'C1', 2)],
      [],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].characteristicIds).toEqual(['a', 'b', 'c'])
  })

  it('orders groups by class sort_order, not input order', () => {
    const groups = buildCharacteristicGroups(
      [cls('C2', 1), cls('C1', 0)],
      [mem('x', 'C1', 0), mem('y', 'C2', 0)],
      [],
    )
    expect(groups.map(g => g.id)).toEqual(['C1', 'C2'])
  })

  it('dedupes a shared characteristic into the first class only', () => {
    const groups = buildCharacteristicGroups(
      [cls('C1', 0), cls('C2', 1)],
      [
        mem('shared', 'C1', 0),
        mem('a', 'C1', 1),
        mem('shared', 'C2', 0),
        mem('b', 'C2', 1),
      ],
      [],
    )
    expect(groups[0].characteristicIds).toEqual(['shared', 'a'])
    expect(groups[1].characteristicIds).toEqual(['b'])
  })

  it('drops a group whose members were all deduped to an earlier class', () => {
    const groups = buildCharacteristicGroups(
      [cls('C1', 0), cls('C2', 1)],
      [mem('x', 'C1', 0), mem('x', 'C2', 0)],
      [],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toEqual('C1')
  })

  it('applies the per-product override within a group', () => {
    const overrides: CharOrderRow[] = [
      { characteristic_id: 'c', sort_order: 0 },
      { characteristic_id: 'a', sort_order: 1 },
    ]
    const groups = buildCharacteristicGroups(
      [cls('C1', 0)],
      [mem('a', 'C1', 0), mem('b', 'C1', 1), mem('c', 'C1', 2)],
      overrides,
    )
    // c, a explicitly first by override; b keeps its relative position after.
    expect(groups[0].characteristicIds).toEqual(['c', 'a', 'b'])
  })

  it('does not let an override leak across groups', () => {
    // Override references 'y' (in C2) — must not reorder C1, and within C2 it
    // pulls 'y' ahead of 'x'.
    const overrides: CharOrderRow[] = [{ characteristic_id: 'y', sort_order: 0 }]
    const groups = buildCharacteristicGroups(
      [cls('C1', 0), cls('C2', 1)],
      [mem('a', 'C1', 0), mem('b', 'C1', 1), mem('x', 'C2', 0), mem('y', 'C2', 1)],
      overrides,
    )
    expect(groups[0].characteristicIds).toEqual(['a', 'b'])
    expect(groups[1].characteristicIds).toEqual(['y', 'x'])
  })

  it('preserves the flat invariant: concatenated pre-override ids equal class-derived order', () => {
    // Build groups with NO override, then concatenate — should equal the flat
    // dedup order produced by the api.ts class-derived path.
    const classes = [cls('C1', 0), cls('C2', 1)]
    const members = [
      mem('a', 'C1', 0),
      mem('b', 'C1', 1),
      mem('a', 'C2', 0), // dup, dropped
      mem('c', 'C2', 1),
    ]
    const groups = buildCharacteristicGroups(classes, members, [])
    const flat = groups.flatMap(g => g.characteristicIds)
    expect(flat).toEqual(['a', 'b', 'c'])
  })

  it('carries name and name_i18n through to each group', () => {
    const groups = buildCharacteristicGroups(
      [cls('C1', 0, 'Materials', { sr: 'Materijali' })],
      [mem('a', 'C1', 0)],
      [],
    )
    expect(groups[0].name).toEqual('Materials')
    expect(groups[0].name_i18n).toEqual({ sr: 'Materijali' })
  })
})
