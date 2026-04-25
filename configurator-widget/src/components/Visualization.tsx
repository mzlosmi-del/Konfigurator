import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import type { VisualizationAsset, Selection } from '../types'
import { resolveImage, resolve3DAsset } from '../resolveImage'
import { t } from '../i18n'

const MODEL_VIEWER_CDN = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'

interface Props {
  assets: VisualizationAsset[]
  selection: Selection
}

function loadModelViewer() {
  if (customElements.get('model-viewer')) return
  const s = document.createElement('script')
  s.type = 'module'
  s.src = MODEL_VIEWER_CDN
  document.head.appendChild(s)
}

function ModelViewer3D({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''
    const mv = document.createElement('model-viewer')
    mv.setAttribute('src', url)
    mv.setAttribute('camera-controls', '')
    mv.setAttribute('auto-rotate', '')
    mv.setAttribute('shadow-intensity', '1')
    mv.setAttribute('ar', '')
    mv.style.width = '100%'
    mv.style.height = '100%'
    container.appendChild(mv)
    return () => { container.innerHTML = '' }
  }, [url])

  return <div ref={containerRef} style="width:100%;height:100%" />
}

export function Visualization({ assets, selection }: Props) {
  const url3d = resolve3DAsset(assets, selection)
  const urlImg = resolveImage(assets, selection)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [urlImg])

  useEffect(() => {
    if (url3d) loadModelViewer()
  }, [url3d])

  if (!url3d && (!urlImg || failed)) return null

  return (
    <div class="cw-visual">
      {url3d
        ? <ModelViewer3D url={url3d} />
        : <img src={urlImg!} alt={t('Product visualization')} onError={() => setFailed(true)} />
      }
    </div>
  )
}
