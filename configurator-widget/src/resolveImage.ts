import type {
  VisualizationAsset,
  VisualizationAssignment,
  Selection,
  NumericInputs,
} from './types'

/**
 * Resolve the best displayable image URL for the current selection.
 *
 * 1. Assignment table (migration 095): walk rows by (priority ASC, id ASC).
 *    A row matches when EVERY condition passes. A characteristic with no
 *    condition is a wildcard. An unmade choice on a conditioned characteristic
 *    fails the row. First fully-matching row wins -> its asset's url.
 * 2. Legacy fallback: value-specific asset (characteristic_value_id match),
 *    then is_default, then null.
 *
 * Only 'image' and 'render' asset types are considered. Use resolve3DAsset()
 * for '3d_model' assets.
 */
export function resolveImage(
  assets: VisualizationAsset[],
  selection: Selection,
  assignments: VisualizationAssignment[] = [],
  numericInputs: NumericInputs = {},
): string | null {
  const displayable = (a: VisualizationAsset) =>
    a.asset_type === 'image' || a.asset_type === 'render'

  // 1. Assignment table
  if (assignments.length > 0) {
    const byId = new Map(assets.filter(displayable).map(a => [a.id, a]))
    const ordered = [...assignments].sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id)
    )
    for (const row of ordered) {
      const target = byId.get(row.asset_id)
      if (!target) continue // points at a deleted / non-displayable asset
      if (row.conditions.every(c => conditionPasses(c, selection, numericInputs))) {
        return target.url
      }
    }
  }

  // 2. Legacy fallback
  const selectedValueIds = new Set(Object.values(selection))
  const valueMatches = assets.filter(
    a => displayable(a) &&
         a.characteristic_value_id !== null &&
         selectedValueIds.has(a.characteristic_value_id!)
  )
  if (valueMatches.length > 0) return stableFirst(valueMatches)

  const defaults = assets.filter(a => displayable(a) && a.is_default)
  if (defaults.length > 0) return stableFirst(defaults)

  return null
}

function conditionPasses(
  c: VisualizationAssignment['conditions'][number],
  selection: Selection,
  numericInputs: NumericInputs,
): boolean {
  // Select cell: operator 'eq' + value_id.
  if (c.value_id !== null) {
    return selection[c.characteristic_id] === c.value_id
  }
  // Numeric cell: operator + numeric_value.
  if (c.numeric_value !== null) {
    const input = numericInputs[c.characteristic_id]
    if (input === undefined) return false // unmade choice cannot match
    switch (c.operator) {
      case 'eq': return input === c.numeric_value
      case 'gt': return input > c.numeric_value
      case 'lt': return input < c.numeric_value
    }
  }
  // Malformed condition (no value_id, no numeric_value) never matches.
  return false
}

/** Resolve the best 3D model URL for the current selection. Same priority logic as resolveImage. */
export function resolve3DAsset(
  assets: VisualizationAsset[],
  selection: Selection
): string | null {
  const candidates = assets.filter(a => a.asset_type === '3d_model')
  const selectedValueIds = new Set(Object.values(selection))

  const valueMatches = candidates.filter(
    a => a.characteristic_value_id !== null &&
         selectedValueIds.has(a.characteristic_value_id!)
  )
  if (valueMatches.length > 0) return stableFirst(valueMatches)

  const defaults = candidates.filter(a => a.is_default)
  if (defaults.length > 0) return stableFirst(defaults)

  return null
}

function stableFirst(assets: VisualizationAsset[]): string {
  const sorted = [...assets].sort((a, b) =>
    a.sort_order !== b.sort_order
      ? a.sort_order - b.sort_order
      : a.id.localeCompare(b.id)
  )
  return sorted[0].url
}
