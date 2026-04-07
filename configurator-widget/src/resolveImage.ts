import type { VisualizationAsset, Selection } from './types'

/**
 * Resolve the best displayable URL for the current selection.
 *
 * Priority order:
 *   1. Value-specific asset whose characteristic_value_id matches a selected value,
 *      with lowest sort_order winning. If sort_order ties, id (lexicographic) breaks it.
 *   2. Default asset (is_default === true), same tiebreak.
 *   3. null — show nothing.
 *
 * Only 'image' and 'render' asset types are resolved to a URL here.
 * '3d_model' assets are stored in the schema but display is deferred
 * (no viewer implemented yet); they fall through to the next candidate.
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

function stableFirst(assets: VisualizationAsset[]): string {
  const sorted = [...assets].sort((a, b) =>
    a.sort_order !== b.sort_order
      ? a.sort_order - b.sort_order
      : a.id.localeCompare(b.id)
  )
  return sorted[0].url
}
