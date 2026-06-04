// Pure helper that partitions a product's characteristics into per-class groups
// (one group per assigned characteristic class). Each group becomes a tab in the
// widget. Mirrors the dedup + ordering rules used by the flat path in api.ts, so
// the concatenation of all groups' ids (before per-product override) equals the
// flat class-derived order.

import { applyCharacteristicOrder, type CharOrderRow } from './charOrder'

export interface ClassMemberRow {
  characteristic_id: string
  class_id:          string
  sort_order:        number
}

export interface ClassMeta {
  id:         string                     // class_id
  sort_order: number                     // from product_classes (per-product order)
  name:       string
  name_i18n?: Record<string, string>
}

export interface RawCharacteristicGroup {
  id:                string
  name:              string
  name_i18n?:        Record<string, string>
  characteristicIds: string[]
}

/**
 * Build per-class characteristic groups, applying:
 *  - class ordering by `ClassMeta.sort_order` (i.e. product_classes.sort_order),
 *  - member ordering by `characteristic_class_members.sort_order` within a class,
 *  - dedup ACROSS groups: a characteristic appears only in the FIRST class
 *    (by class sort_order) that contains it,
 *  - the per-product `product_characteristic_order` override applied WITHIN each
 *    group (reuses `applyCharacteristicOrder`; override rows for ids not in a
 *    group are ignored, so overrides never leak across groups).
 *
 * Groups whose members were all deduped away to earlier classes are dropped.
 */
export function buildCharacteristicGroups(
  classes:        ClassMeta[],
  members:        ClassMemberRow[],
  orderOverrides: CharOrderRow[],
): RawCharacteristicGroup[] {
  // 1. Stable sort classes by their per-product sort_order.
  const sortedClasses = [...classes].sort((a, b) => a.sort_order - b.sort_order)

  // 2. Members grouped by class, each ordered by member sort_order.
  const membersByClass = new Map<string, ClassMemberRow[]>()
  for (const m of members) {
    const list = membersByClass.get(m.class_id)
    if (list) list.push(m)
    else membersByClass.set(m.class_id, [m])
  }
  for (const list of membersByClass.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order)
  }

  // 3. Walk classes in order, first-class-wins dedup across all groups.
  const seen = new Set<string>()
  const groups: RawCharacteristicGroup[] = []
  for (const cls of sortedClasses) {
    const ids: string[] = []
    for (const m of membersByClass.get(cls.id) ?? []) {
      if (seen.has(m.characteristic_id)) continue
      seen.add(m.characteristic_id)
      ids.push(m.characteristic_id)
    }
    // 4. Apply the per-product override within this group only.
    const ordered = applyCharacteristicOrder(ids, orderOverrides)
    // 5. Drop empty groups (all members deduped to earlier classes).
    if (ordered.length === 0) continue
    groups.push({
      id:                cls.id,
      name:              cls.name,
      name_i18n:         cls.name_i18n,
      characteristicIds: ordered,
    })
  }

  return groups
}
