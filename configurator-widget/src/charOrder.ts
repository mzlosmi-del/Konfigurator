// Pure helper that applies a per-product characteristic-order override on top
// of the class-derived order. Mirrored in
// configurator-admin/src/lib/charOrder.ts — keep the two in sync.

export interface CharOrderRow {
  characteristic_id: string
  sort_order:        number
}

/**
 * Re-order `orderedCharIds` (the class-derived default order) using explicit
 * per-product overrides.
 *
 * Characteristics that have an override row come first, ordered by their
 * `sort_order`. Characteristics without an override keep their original
 * relative order and follow after. Override rows referencing a characteristic
 * not present in `orderedCharIds` are ignored.
 *
 * With no overrides, the input order is returned unchanged.
 */
export function applyCharacteristicOrder(
  orderedCharIds: string[],
  overrides:      CharOrderRow[],
): string[] {
  if (overrides.length === 0) return orderedCharIds

  const present  = new Set(orderedCharIds)
  const orderMap = new Map<string, number>()
  for (const o of overrides) {
    if (present.has(o.characteristic_id)) orderMap.set(o.characteristic_id, o.sort_order)
  }
  if (orderMap.size === 0) return orderedCharIds

  const overridden = orderedCharIds
    .filter(id => orderMap.has(id))
    .sort((a, b) => orderMap.get(a)! - orderMap.get(b)!)
  const rest = orderedCharIds.filter(id => !orderMap.has(id))

  return [...overridden, ...rest]
}
