import type { VisualizationAsset, Selection } from './types'

/**
 * Resolve the best displayable image URL for the current selection.
 *
 * Priority order:
 *   1. Value-specific asset whose characteristic_value_id matches a selected value,
 *      with lowest sort_order winning. If sort_order ties, id (lexicographic) breaks it.
 *   2. Default asset (is_default === true), same tiebreak.
 *   3. null — show nothing.
 *
 * Only 'image' and 'render' asset types are considered here.
 * Use resolve3DAsset() for '3d_model' assets.
 */
export function resolveImage(
  assets: VisualizationAsset[],
  selection: Selection
): string | null {
  const displayable = (a: VisualizationAsset) =>
    a.asset_type === 'image' || a.asset_type === 'render'

  const selectedValueIds = new Set(Object.values(selection))

  const valueMatches = assets.filter(
    a => displayable(a) &&
         a.characteristic_value_id !== null &&
         selectedValueIds.has(a.characteristic_value_id!)
  )

  if (valueMatches.length > 0) {
    return stableFirst(valueMatches)
  }

  const defaults = assets.filter(a => displayable(a) && a.is_default)
  if (defaults.length > 0) {
    return stableFirst(defaults)
  }

  return null
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
