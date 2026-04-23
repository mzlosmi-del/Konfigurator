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
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return (
      <div class="cw-visual">
        <div class="cw-visual-placeholder">{t('No image available')}</div>
      </div>
    )
  }

  return (
    <div class="cw-visual">
      <img
        src={url}
        alt={t('Product visualization')}
        class={loaded ? '' : 'loading'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
