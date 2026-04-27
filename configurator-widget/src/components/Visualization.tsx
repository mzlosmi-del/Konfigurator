import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import type { VisualizationAsset, Selection, NumericInputs, MeshRule } from '../types'
import { resolveImage, resolve3DAsset } from '../resolveImage'
import { t } from '../i18n'

const MODEL_VIEWER_CDN = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'

interface Props {
  assets: VisualizationAsset[]
  selection: Selection
  numericInputs?: NumericInputs
  arEnabled?: boolean
}

function loadModelViewer() {
  if (customElements.get('model-viewer')) return
  const s = document.createElement('script')
  s.type = 'module'
  s.src = MODEL_VIEWER_CDN
  document.head.appendChild(s)
}

type ThreeScene = { isScene: true; traverse: (cb: (node: unknown) => void) => void }

function findScene(mv: HTMLElement): ThreeScene | null {
  // Try the named getter first (works on unminified / some CDN builds)
  const direct = (mv as unknown as { scene?: ThreeScene }).scene
  if (direct?.traverse) return direct
  // ModelScene extends THREE.Scene which sets isScene = true on the instance.
  // On the minified CDN build the getter is renamed, but the instance symbol
  // property added by model-viewer is still enumerable via getOwnPropertySymbols.
  for (const sym of Object.getOwnPropertySymbols(mv)) {
    try {
      const v = (mv as unknown as Record<symbol, unknown>)[sym]
      if (
        v !== null && typeof v === 'object' &&
        (v as ThreeScene).isScene === true &&
        typeof (v as ThreeScene).traverse === 'function'
      ) return v as ThreeScene
    } catch { /* symbol getter may throw */ }
  }
  return null
}

function applyMeshRules(
  mv: HTMLElement,
  rules: MeshRule[],
  selection: Selection,
  numericInputs: NumericInputs,
) {
  const scene = findScene(mv)
  if (!scene) return

  const selectedValueIds = new Set(Object.values(selection))

  // Collect which mesh names have visibility rules (so we know to gate their visibility)
  const meshesWithRules = new Set(
    rules.filter(r => r.type === 'visibility').map(r => r.mesh_name),
  )

  scene.traverse((node: unknown) => {
    const n = node as {
      name?: string
      visible?: boolean
      isMesh?: boolean
      isGroup?: boolean
      scale?: { x: number; y: number; z: number }
    }
    if (!n.name) return

    // Visibility
    if (meshesWithRules.has(n.name)) {
      const matchingRules = rules.filter(
        r => r.type === 'visibility' && r.mesh_name === n.name,
      )
      const shouldBeVisible = matchingRules.some(r => selectedValueIds.has(r.value_id))
      n.visible = shouldBeVisible
    }

    // Dimensions
    const dimRules = rules.filter(r => r.type === 'dimension' && r.node_name === n.name)
    for (const rule of dimRules) {
      if (!n.scale) continue
      const rawVal = numericInputs[rule.characteristic_id]
      if (rawVal === undefined) continue
      const span = rule.value_max - rule.value_min
      const t_ = span === 0 ? 0 : Math.max(0, Math.min(1, (rawVal - rule.value_min) / span))
      const scale = rule.scale_min + t_ * (rule.scale_max - rule.scale_min)
      if (rule.axis === 'x') n.scale.x = scale
      else if (rule.axis === 'y') n.scale.y = scale
      else n.scale.z = scale
    }
  })
}

function ModelViewer3D({
  url,
  rules,
  selection,
  numericInputs,
  arEnabled,
}: {
  url: string
  rules: MeshRule[]
  selection: Selection
  numericInputs: NumericInputs
  arEnabled: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mvRef = useRef<HTMLElement | null>(null)
  const loadedRef = useRef(false)

  // Mount the model-viewer element once when url changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''
    loadedRef.current = false

    const mv = document.createElement('model-viewer')
    mv.setAttribute('src', url)
    mv.setAttribute('camera-controls', '')
    mv.setAttribute('auto-rotate', '')
    mv.setAttribute('shadow-intensity', '1')
    if (arEnabled) {
      mv.setAttribute('ar', '')
      mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
    }
    mv.style.width = '100%'
    mv.style.height = '100%'

    mv.addEventListener('load', () => {
      loadedRef.current = true
      applyMeshRules(mv, rules, selection, numericInputs)
    })

    mvRef.current = mv
    container.appendChild(mv)
    return () => { container.innerHTML = ''; mvRef.current = null; loadedRef.current = false }
  }, [url])

  // Re-apply rules whenever selection or numericInputs change
  useEffect(() => {
    if (!mvRef.current || !loadedRef.current) return
    applyMeshRules(mvRef.current, rules, selection, numericInputs)
  }, [rules, selection, numericInputs])

  return <div ref={containerRef} style="width:100%;height:100%" />
}

export function Visualization({ assets, selection, numericInputs = {}, arEnabled = true }: Props) {
  const url3d    = resolve3DAsset(assets, selection)
  const urlImg   = resolveImage(assets, selection)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [urlImg])

  useEffect(() => {
    if (url3d) loadModelViewer()
  }, [url3d])

  if (!url3d && (!urlImg || failed)) return null

  // Find mesh rules for the active 3D asset
  const activeAsset = url3d ? assets.find(a => a.url === url3d) : null
  const meshRules: MeshRule[] = activeAsset?.mesh_rules ?? []

  return (
    <div class="cw-visual">
      {url3d
        ? <ModelViewer3D
            url={url3d}
            rules={meshRules}
            selection={selection}
            numericInputs={numericInputs}
            arEnabled={arEnabled}
          />
        : <img src={urlImg!} alt={t('Product visualization')} onError={() => setFailed(true)} />
      }
    </div>
  )
}
