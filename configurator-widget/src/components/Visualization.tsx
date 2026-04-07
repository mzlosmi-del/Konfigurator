import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import type { VisualizationAsset, Selection } from '../types'

interface Props {
  assets: VisualizationAsset[]
  selection: Selection
}

function resolveImage(assets: VisualizationAsset[], selection: Selection): string | null {
  // Find the first asset matching any selected value, in selection order
  for (const valueId of Object.values(selection)) {
    const match = assets.find(
      a => a.characteristic_value_id === valueId && a.asset_type === 'image'
    )
    if (match) return match.url
  }
  // Fall back to default
  const def = assets.find(a => a.is_default && a.asset_type === 'image')
  return def?.url ?? null
}

export function Visualization({ assets, selection }: Props) {
  const url = resolveImage(assets, selection)
  const [loaded, setLoaded] = useState(false)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)

  useEffect(() => {
    if (url !== currentUrl) {
      setLoaded(false)
      setCurrentUrl(url)
    }
  }, [url])

  if (!url) {
    return (
      <div class="cw-visual">
        <div class="cw-visual-placeholder">No image available</div>
      </div>
    )
  }

  return (
    <div class="cw-visual">
      <img
        src={url}
        alt="Product visualization"
        class={loaded ? '' : 'loading'}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
