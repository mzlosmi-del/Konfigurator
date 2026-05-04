import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import type { VisualizationAsset, Selection, NumericInputs, MeshRule } from '../types'
import { resolveImage, resolve3DAsset } from '../resolveImage'
import { t } from '../i18n'

const MODEL_VIEWER_CDN = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'

interface Props {
  assets:         VisualizationAsset[]
  selection:      Selection
  numericInputs?: NumericInputs
  arEnabled?:     boolean
  arPlacement?:   'floor' | 'wall'
}

function loadModelViewer() {
  if (customElements.get('model-viewer')) return
  const s = document.createElement('script')
  s.type = 'module'
  s.src = MODEL_VIEWER_CDN
  document.head.appendChild(s)
}

type ThreeScene = { isScene?: boolean; isGroup?: boolean; traverse: (cb: (node: unknown) => void) => void }

function findScene(mv: HTMLElement): ThreeScene | null {
  // Try the named getter first (works on unminified / some CDN builds)
  const direct = (mv as unknown as { scene?: ThreeScene }).scene
  if (direct?.traverse) return direct
  // model-viewer stores its internal scene (ModelScene) as a private Symbol
  // property on the element. In older builds ModelScene extends THREE.Scene
  // (isScene=true); in 3.x it extends THREE.Group (isGroup=true). Accept either.
  for (const sym of Object.getOwnPropertySymbols(mv)) {
    try {
      const v = (mv as unknown as Record<symbol, unknown>)[sym] as any
      if (
        v !== null && typeof v === 'object' &&
        (v.isScene === true || v.isGroup === true) &&
        typeof v.traverse === 'function'
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
      position?: { x: number; y: number; z: number }
    }
    if (!n.name) return

    // Visibility
    if (meshesWithRules.has(n.name)) {
      const matchingRules = rules.filter(
        r => r.type === 'visibility' && r.mesh_name === n.name,
      )
      n.visible = matchingRules.some(r => selectedValueIds.has(r.value_id))
    }

    // Dimensions (scale)
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

    // Translations (hardware nodes outside the scalable group)
    // offset_min/max are delta offsets applied to the node's local position
    const translateRules = rules.filter(r => r.type === 'translate' && r.node_name === n.name)
    for (const rule of translateRules) {
      if (!n.position) continue
      const rawVal = numericInputs[rule.characteristic_id]
      if (rawVal === undefined) continue
      const span = rule.value_max - rule.value_min
      const t_ = span === 0 ? 0 : Math.max(0, Math.min(1, (rawVal - rule.value_min) / span))
      const offset = rule.offset_min + t_ * (rule.offset_max - rule.offset_min)
      if (rule.axis === 'x') n.position.x = offset
      else if (rule.axis === 'y') n.position.y = offset
      else n.position.z = offset
    }
  })
}

// Gold colour: #ffc34d
const GLOW_R = 1.0
const GLOW_G = 0.765
const GLOW_B = 0.302
const GLOW_INTENSITY = 0.6
const GLOW_DURATION = 2000

function triggerGlow(
  scene: ThreeScene,
  rules: MeshRule[],
  newValueIds: string[],
) {
  const meshNamesToGlow = new Set<string>()
  for (const valueId of newValueIds) {
    for (const rule of rules) {
      if (rule.type === 'visibility' && rule.value_id === valueId) {
        meshNamesToGlow.add(rule.mesh_name)
      }
    }
  }
  if (meshNamesToGlow.size === 0) return

  scene.traverse((node: unknown) => {
    const n = node as any
    if (!n.isMesh || !n.name || !meshNamesToGlow.has(n.name) || !n.visible) return

    const orig = n.material
    const clone = orig.clone()
    n.material = clone
    clone.emissive.r = GLOW_R
    clone.emissive.g = GLOW_G
    clone.emissive.b = GLOW_B
    clone.emissiveIntensity = GLOW_INTENSITY

    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / GLOW_DURATION)
      clone.emissiveIntensity = GLOW_INTENSITY * (1 - progress)
      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        clone.dispose()
        if (n.material === clone) n.material = orig
      }
    }
    requestAnimationFrame(tick)
  })
}

function ModelViewer3D({
  url,
  rules,
  selection,
  numericInputs,
  arEnabled,
  arPlacement,
}: {
  url:          string
  rules:        MeshRule[]
  selection:    Selection
  numericInputs: NumericInputs
  arEnabled:    boolean
  arPlacement:  'floor' | 'wall'
}) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const mvRef           = useRef<HTMLElement | null>(null)
  const hintRef         = useRef<HTMLElement | null>(null)
  const loadedRef       = useRef(false)
  const selectionRef    = useRef(selection)
  const numericInputsRef = useRef(numericInputs)
  const prevSelectionRef = useRef<Selection | null>(null)

  // Keep refs current on every render (safe to do outside useEffect)
  selectionRef.current     = selection
  numericInputsRef.current = numericInputs

  // Mount the model-viewer element once when url changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''
    loadedRef.current      = false
    prevSelectionRef.current = null

    const mv = document.createElement('model-viewer')
    mv.setAttribute('src', url)
    mv.setAttribute('camera-controls', '')
    mv.setAttribute('auto-rotate', '')
    mv.setAttribute('shadow-intensity', '1')
    mv.setAttribute('shadow-softness', '1')
    mv.setAttribute('environment-image', 'neutral')
    mv.style.width = '100%'
    mv.style.height = '100%'

    if (arEnabled) {
      mv.setAttribute('ar', '')
      mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
      mv.setAttribute('ar-placement', arPlacement)
      mv.setAttribute('ar-scale', 'fixed')

      const arBtn = document.createElement('button')
      arBtn.setAttribute('slot', 'ar-button')
      arBtn.className = 'cw-ar-btn'
      arBtn.textContent = t('View in AR')
      mv.appendChild(arBtn)

      const hint = document.createElement('div')
      hint.className = 'cw-ar-hint'
      hint.textContent = arPlacement === 'wall'
        ? t('AR ready — point at a wall to place')
        : t('AR ready — point at the floor to place')
      hint.style.display = 'none'
      mv.appendChild(hint)
      hintRef.current = hint

      mv.addEventListener('ar-status', (e: Event) => {
        const status = (e as CustomEvent<{ status: string }>).detail?.status ?? ''
        if (hint) hint.style.display = status === 'object-placed' ? 'none' : 'block'
      })
    }

    mv.addEventListener('load', () => {
      loadedRef.current = true
      // Capture current selection as baseline so first user change triggers glow
      prevSelectionRef.current = { ...selectionRef.current }
      applyMeshRules(mv, rules, selectionRef.current, numericInputsRef.current)
      if (arEnabled && hintRef.current) hintRef.current.style.display = 'block'
    })

    mvRef.current = mv
    container.appendChild(mv)
    return () => {
      container.innerHTML = ''
      mvRef.current        = null
      hintRef.current      = null
      loadedRef.current    = false
      prevSelectionRef.current = null
    }
  }, [url, arEnabled, arPlacement])

  // Re-apply rules whenever selection or numericInputs change
  useEffect(() => {
    if (!mvRef.current || !loadedRef.current) return
    applyMeshRules(mvRef.current, rules, selection, numericInputs)
  }, [rules, selection, numericInputs])

  // Gold glow on discrete characteristic selection change (not on numeric inputs)
  useEffect(() => {
    if (!mvRef.current || !loadedRef.current || prevSelectionRef.current === null) return

    const newValueIds: string[] = []
    for (const [charId, valueId] of Object.entries(selection)) {
      if (prevSelectionRef.current[charId] !== valueId) newValueIds.push(valueId)
    }
    prevSelectionRef.current = { ...selection }

    if (newValueIds.length === 0) return
    const scene = findScene(mvRef.current)
    if (!scene) return
    triggerGlow(scene, rules, newValueIds)
  }, [selection]) // intentionally excludes numericInputs — glow only for discrete changes

  return <div ref={containerRef} style="width:100%;height:100%" />
}

export function Visualization({ assets, selection, numericInputs = {}, arEnabled = true, arPlacement = 'floor' }: Props) {
  const url3d    = resolve3DAsset(assets, selection)
  const urlImg   = resolveImage(assets, selection)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [urlImg])

  useEffect(() => {
    if (url3d) loadModelViewer()
  }, [url3d])

  if (!url3d && (!urlImg || failed)) return null

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
            arPlacement={arPlacement}
          />
        : <img src={urlImg!} alt={t('Product visualization')} onError={() => setFailed(true)} />
      }
    </div>
  )
}
