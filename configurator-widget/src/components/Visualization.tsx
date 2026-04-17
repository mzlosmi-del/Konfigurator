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
      />
    </div>
  )
}
