import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import type { VisualizationAsset, Selection } from '../types'
import { resolveImage } from '../resolveImage'
import { t } from '../i18n'

interface Props {
  assets: VisualizationAsset[]
  selection: Selection
}

export function Visualization({ assets, selection }: Props) {
  const url = resolveImage(assets, selection)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return null
  }

  return (
    <div class="cw-visual">
      <img
        src={url}
        alt={t('Product visualization')}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
