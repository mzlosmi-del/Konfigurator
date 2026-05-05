import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import type { VisualizationAsset, Selection, NumericInputs, MeshRule, MeshTextureRule } from '../types'
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
  const direct = (mv as unknown as { scene?: ThreeScene }).scene
  if (direct?.traverse) return direct
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

// ── Rule application ──────────────────────────────────────────────────────────

function applyVisibilityRules(
  mv: HTMLElement,
  rules: MeshRule[],
  selection: Selection,
) {
  const scene = findScene(mv)
  if (!scene) return

  const selectedValueIds = new Set(Object.values(selection))
  const meshesWithRules = new Set(
    rules.filter(r => r.type === 'visibility').map(r => r.mesh_name),
  )

  scene.traverse((node: unknown) => {
    const n = node as { name?: string; visible?: boolean }
    if (!n.name || !meshesWithRules.has(n.name)) return
    const matching = rules.filter(r => r.type === 'visibility' && r.mesh_name === n.name)
    n.visible = matching.some(r => selectedValueIds.has(r.value_id))
  })
}

// Apply texture rules via model-viewer Materials API (async, best-effort).
async function applyTextureRules(mv: HTMLElement, rules: MeshRule[], selection: Selection) {
  const model = (mv as any).model
  if (!model) return
  const selectedValueIds = new Set(Object.values(selection))
  const textureRules = rules.filter(r => r.type === 'texture') as MeshTextureRule[]
  for (const rule of textureRules) {
    if (!selectedValueIds.has(rule.value_id) || !rule.texture_url) continue
    const mat = (model.materials as any[]).find((m: any) => m.name === rule.mesh_name)
    if (!mat) continue
    try {
      const texture = await (mv as any).createTexture(rule.texture_url)
      if (rule.channel === 'baseColor') {
        mat.pbrMetallicRoughness.baseColorTexture.setTexture(texture)
      } else if (rule.channel === 'normal') {
        mat.normalTexture.setTexture(texture)
      } else if (rule.channel === 'roughness') {
        mat.pbrMetallicRoughness.metallicRoughnessTexture.setTexture(texture)
      }
    } catch { /* texture load failure is non-fatal */ }
  }
}

// Shift camera target toward the centroid of newly selected visible meshes.
function focusCameraOnNewMeshes(mv: HTMLElement, scene: ThreeScene, meshNames: Set<string>) {
  let cx = 0, cy = 0, cz = 0, count = 0
  scene.traverse((node: unknown) => {
    const n = node as any
    if (!n.isMesh || !n.visible || !meshNames.has(n.name)) return
    if (n.geometry) {
      n.geometry.computeBoundingSphere()
      const sphere = n.geometry.boundingSphere
      const m = n.matrixWorld.elements as number[]
      cx += m[12] + sphere.center.x
      cy += m[13] + sphere.center.y
      cz += m[14] + sphere.center.z
      count++
    }
  })
  if (count === 0) return
  ;(mv as any).cameraTarget = `${(cx / count).toFixed(3)}m ${(cy / count).toFixed(3)}m ${(cz / count).toFixed(3)}m`
}

// Full synchronous apply — used only on initial model load.
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
      scale?: { x: number; y: number; z: number }
      position?: { x: number; y: number; z: number }
    }
    if (!n.name) return

    if (meshesWithRules.has(n.name)) {
      const matching = rules.filter(r => r.type === 'visibility' && r.mesh_name === n.name)
      n.visible = matching.some(r => selectedValueIds.has(r.value_id))
    }

    for (const rule of rules) {
      // Dimension scaling disabled
      // if (rule.type === 'dimension' && rule.node_name === n.name && n.scale) {
      //   const raw = numericInputs[rule.characteristic_id]
      //   if (raw === undefined) continue
      //   const t_ = Math.max(0, Math.min(1, (raw - rule.value_min) / (rule.value_max - rule.value_min)))
      //   const s = rule.scale_min + t_ * (rule.scale_max - rule.scale_min)
      //   if (rule.axis === 'x') n.scale.x = s
      //   else if (rule.axis === 'y') n.scale.y = s
      //   else n.scale.z = s
      // }
      if (rule.type === 'translate' && rule.node_name === n.name && n.position) {
        const raw = numericInputs[rule.characteristic_id]
        if (raw === undefined) continue
        const t_ = Math.max(0, Math.min(1, (raw - rule.value_min) / (rule.value_max - rule.value_min)))
        const off = rule.offset_min + t_ * (rule.offset_max - rule.offset_min)
        if (rule.axis === 'x') n.position.x = off
        else if (rule.axis === 'y') n.position.y = off
        else n.position.z = off
      }
    }
  })
}

// Tween dimension + translate rules from current values to targets over `duration` ms.
function tweenDimensions(
  mv: HTMLElement,
  rules: MeshRule[],
  numericInputs: NumericInputs,
  duration: number,
  rafRef: { current: number | null },
) {
  if (rafRef.current !== null) {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const scene = findScene(mv)
  if (!scene) return

  type Anim = { node: any; prop: 'scale' | 'position'; axis: 'x' | 'y' | 'z'; from: number; to: number }
  const animations: Anim[] = []

  scene.traverse((node: unknown) => {
    const n = node as any
    if (!n.name) return

    for (const rule of rules) {
      if (rule.type === 'dimension' && rule.node_name === n.name && n.scale) {
        const raw = numericInputs[rule.characteristic_id]
        if (raw === undefined) continue
        const t_ = Math.max(0, Math.min(1, (raw - rule.value_min) / (rule.value_max - rule.value_min)))
        const to = rule.scale_min + t_ * (rule.scale_max - rule.scale_min)
        const from = n.scale[rule.axis] as number
        if (Math.abs(to - from) > 0.0001) animations.push({ node: n, prop: 'scale', axis: rule.axis, from, to })
      }
      if (rule.type === 'translate' && rule.node_name === n.name && n.position) {
        const raw = numericInputs[rule.characteristic_id]
        if (raw === undefined) continue
        const t_ = Math.max(0, Math.min(1, (raw - rule.value_min) / (rule.value_max - rule.value_min)))
        const to = rule.offset_min + t_ * (rule.offset_max - rule.offset_min)
        const from = n.position[rule.axis] as number
        if (Math.abs(to - from) > 0.0001) animations.push({ node: n, prop: 'position', axis: rule.axis, from, to })
      }
    }
  })

  if (animations.length === 0) return

  const start = performance.now()
  function tick(now: number) {
    const progress = Math.min(1, (now - start) / duration)
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    for (const a of animations) a.node[a.prop][a.axis] = a.from + eased * (a.to - a.from)
    if (progress < 1) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      rafRef.current = null
    }
  }
  rafRef.current = requestAnimationFrame(tick)
}

// ── Highlight / glow ──────────────────────────────────────────────────────────

const GLOW_R          = 1.0
const GLOW_G          = 0.765
const GLOW_B          = 0.302
const GLOW_INTENSITY  = 0.6
const HIGHLIGHT_INTENSITY = 0.10  // emissive intensity kept after glow settles
const GLOW_DURATION   = 2000      // ms — glow → settle animation
const FADE_DURATION   = 500       // ms — fade-out when option is deselected

type HighlightEntry = { clone: any; orig: any }

function updateHighlights(
  scene: ThreeScene,
  rules: MeshRule[],
  removedValueIds: string[],
  addedValueIds: string[],
  highlight: Map<string, HighlightEntry>,
) {
  const removedMeshNames = new Set<string>()
  for (const vid of removedValueIds)
    for (const r of rules)
      if (r.type === 'visibility' && r.value_id === vid) removedMeshNames.add(r.mesh_name)

  const addedMeshNames = new Set<string>()
  for (const vid of addedValueIds)
    for (const r of rules)
      if (r.type === 'visibility' && r.value_id === vid) addedMeshNames.add(r.mesh_name)

  // Fade out meshes that lost their selection (skip those about to be re-highlighted)
  for (const meshName of removedMeshNames) {
    if (addedMeshNames.has(meshName)) continue
    const entry = highlight.get(meshName)
    if (!entry) continue
    highlight.delete(meshName)
    const { clone, orig } = entry

    // Find node reference for material restore
    let targetNode: any = null
    scene.traverse((n: unknown) => {
      const node = n as any
      if (node.isMesh && node.name === meshName && node.material === clone) targetNode = node
    })

    const fromIntensity = clone.emissiveIntensity
    const start = performance.now()
    ;(function tick(now: number) {
      const t = Math.min(1, (now - start) / FADE_DURATION)
      clone.emissiveIntensity = fromIntensity * (1 - t)
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        clone.dispose()
        if (targetNode && targetNode.material === clone) targetNode.material = orig
      }
    })(performance.now())
  }

  // Glow → settle for newly selected meshes
  scene.traverse((node: unknown) => {
    const n = node as any
    if (!n.isMesh || !n.name || !addedMeshNames.has(n.name) || !n.visible) return

    // Dispose any existing highlight for this mesh
    const existing = highlight.get(n.name)
    if (existing) {
      existing.clone.dispose()
      n.material = existing.orig
    }

    const orig = n.material
    const clone = orig.clone()
    n.material = clone
    clone.emissive.r = GLOW_R
    clone.emissive.g = GLOW_G
    clone.emissive.b = GLOW_B
    clone.emissiveIntensity = GLOW_INTENSITY
    highlight.set(n.name, { clone, orig })

    const start = performance.now()
    function tick(now: number) {
      const t = Math.min(1, (now - start) / GLOW_DURATION)
      // ease-out: glow → settle at HIGHLIGHT_INTENSITY
      clone.emissiveIntensity = HIGHLIGHT_INTENSITY + (GLOW_INTENSITY - HIGHLIGHT_INTENSITY) * (1 - t)
      if (t < 1) requestAnimationFrame(tick)
      // at t=1, emissiveIntensity = HIGHLIGHT_INTENSITY — stays until deselected
    }
    requestAnimationFrame(tick)
  })
}

function clearHighlights(scene: ThreeScene | null, highlight: Map<string, HighlightEntry>) {
  if (scene) {
    scene.traverse((node: unknown) => {
      const n = node as any
      if (!n.isMesh || !n.name) return
      const entry = highlight.get(n.name)
      if (entry && n.material === entry.clone) n.material = entry.orig
    })
  }
  for (const { clone } of highlight.values()) clone.dispose()
  highlight.clear()
}

// ── ModelViewer3D component ───────────────────────────────────────────────────

function ModelViewer3D({
  url,
  rules,
  selection,
  numericInputs,
  arEnabled,
  arPlacement,
}: {
  url:           string
  rules:         MeshRule[]
  selection:     Selection
  numericInputs: NumericInputs
  arEnabled:     boolean
  arPlacement:   'floor' | 'wall'
}) {
  const containerRef     = useRef<HTMLDivElement>(null)
  const mvRef            = useRef<HTMLElement | null>(null)
  const hintRef          = useRef<HTMLElement | null>(null)
  const loadedRef        = useRef(false)
  const selectionRef     = useRef(selection)
  const numericInputsRef = useRef(numericInputs)
  const prevSelectionRef = useRef<Selection | null>(null)
  const dimRafRef        = useRef<number | null>(null)
  const highlightRef     = useRef<Map<string, HighlightEntry>>(new Map())

  // Keep refs current on every render
  selectionRef.current     = selection
  numericInputsRef.current = numericInputs

  // Mount model-viewer on URL change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML  = ''
    loadedRef.current    = false
    prevSelectionRef.current = null
    if (dimRafRef.current !== null) { cancelAnimationFrame(dimRafRef.current); dimRafRef.current = null }
    clearHighlights(findScene(mvRef.current ?? document.createElement('div')), highlightRef.current)

    const mv = document.createElement('model-viewer')
    mv.setAttribute('src', url)
    mv.setAttribute('camera-controls', '')
    mv.setAttribute('auto-rotate', '')
    mv.setAttribute('shadow-intensity', '1')
    mv.setAttribute('shadow-softness', '1')
    mv.setAttribute('environment-image', 'neutral')
    mv.style.width  = '100%'
    mv.style.height = '100%'

    if (arEnabled) {
      mv.setAttribute('ar', '')
      mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
      mv.setAttribute('ar-placement', arPlacement)
      mv.setAttribute('ar-scale', 'fixed')

      const arBtn = document.createElement('button')
      arBtn.setAttribute('slot', 'ar-button')
      arBtn.className   = 'cw-ar-btn'
      arBtn.textContent = t('View in AR')
      mv.appendChild(arBtn)

      const hint = document.createElement('div')
      hint.className    = 'cw-ar-hint'
      hint.textContent  = arPlacement === 'wall'
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
      prevSelectionRef.current = { ...selectionRef.current }
      applyMeshRules(mv, rules, selectionRef.current, numericInputsRef.current)
      applyTextureRules(mv, rules, selectionRef.current)
      if (arEnabled && hintRef.current) hintRef.current.style.display = 'block'
    })

    mvRef.current = mv
    container.appendChild(mv)

    return () => {
      if (dimRafRef.current !== null) { cancelAnimationFrame(dimRafRef.current); dimRafRef.current = null }
      clearHighlights(findScene(mv), highlightRef.current)
      container.innerHTML = ''
      mvRef.current       = null
      hintRef.current     = null
      loadedRef.current   = false
      prevSelectionRef.current = null
    }
  }, [url, arEnabled, arPlacement])

  // Visibility + texture update on discrete selection change (instant)
  useEffect(() => {
    if (!mvRef.current || !loadedRef.current) return
    applyVisibilityRules(mvRef.current, rules, selection)
    applyTextureRules(mvRef.current, rules, selection)
  }, [rules, selection])

  // Smooth tween for dimension + translate rules — disabled
  // useEffect(() => {
  //   if (!mvRef.current || !loadedRef.current) return
  //   tweenDimensions(mvRef.current, rules, numericInputs, 250, dimRafRef)
  // }, [rules, numericInputs])

  // Glow → persistent highlight on discrete selection change
  useEffect(() => {
    if (!mvRef.current || !loadedRef.current || prevSelectionRef.current === null) return

    const addedValueIds: string[]   = []
    const removedValueIds: string[] = []
    for (const [charId, valueId] of Object.entries(selection)) {
      const prev = prevSelectionRef.current[charId]
      if (prev !== valueId) {
        addedValueIds.push(valueId)
        if (prev) removedValueIds.push(prev)
      }
    }
    prevSelectionRef.current = { ...selection }

    if (addedValueIds.length === 0) return
    const scene = findScene(mvRef.current)
    if (!scene) return
    updateHighlights(scene, rules, removedValueIds, addedValueIds, highlightRef.current)

    // Shift camera toward the newly visible mesh centroid
    // const addedMeshNames = new Set<string>()
    // for (const vid of addedValueIds)
    //   for (const r of rules)
    //     if (r.type === 'visibility' && r.value_id === vid) addedMeshNames.add(r.mesh_name)
    // if (addedMeshNames.size > 0) focusCameraOnNewMeshes(mvRef.current, scene, addedMeshNames)
  }, [selection]) // intentionally excludes numericInputs

  // Dimension overlay — disabled until layout is finalised
  // const widthRule  = rules.find(r => r.type === 'dimension' && r.axis === 'x')
  // const heightRule = rules.find(r => r.type === 'dimension' && r.axis === 'y')
  // const wVal = widthRule  ? (numericInputs[widthRule.characteristic_id]  ?? 0) : 0
  // const hVal = heightRule ? (numericInputs[heightRule.characteristic_id] ?? 0) : 0

  return (
    <div style="position:relative;width:100%;height:100%">
      <div ref={containerRef} style="width:100%;height:100%" />
      {/* Dimension overlay — disabled
      {(wVal > 0 || hVal > 0) && (
        <svg class="cw-dim-overlay" xmlns="http://www.w3.org/2000/svg">
          {wVal > 0 && (
            <g class="cw-dim-width">
              <line x1="10%" y1="92%" x2="90%" y2="92%" />
              <line x1="10%" y1="89%" x2="10%" y2="95%" />
              <line x1="90%" y1="89%" x2="90%" y2="95%" />
              <text x="50%" y="98%">{wVal} mm</text>
            </g>
          )}
          {hVal > 0 && (
            <g class="cw-dim-height">
              <line x1="6%" y1="8%" x2="6%" y2="88%" />
              <line x1="3%" y1="8%" x2="9%" y2="8%" />
              <line x1="3%" y1="88%" x2="9%" y2="88%" />
              <text x="14" y="50%" style="writing-mode:vertical-rl;transform:rotate(180deg);transform-box:fill-box;transform-origin:center">{hVal} mm</text>
            </g>
          )}
        </svg>
      )}
      */}
    </div>
  )
}

// ── Visualization wrapper ─────────────────────────────────────────────────────

export function Visualization({ assets, selection, numericInputs = {}, arEnabled = true, arPlacement = 'floor' }: Props) {
  const url3d  = resolve3DAsset(assets, selection)
  const urlImg = resolveImage(assets, selection)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [urlImg])
  useEffect(() => { if (url3d) loadModelViewer() }, [url3d])

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
