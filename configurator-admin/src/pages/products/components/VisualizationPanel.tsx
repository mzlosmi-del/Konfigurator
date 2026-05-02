import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Star, StarOff, Upload, Link, ArrowUp, ArrowDown, Network } from 'lucide-react'
import {
  fetchAssetsForProduct,
  createAsset,
  updateAsset,
  deleteAsset,
  reorderAssets,
  uploadAssetFile,
} from '@/lib/assets'
import { fetchProductCharacteristicsWithValues, type CharacteristicWithValues } from '@/lib/products'
import { parseMeshNames } from '@/lib/glbParser'
import type { VisualizationAsset, AssetType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useAuthContext } from '@/components/auth/AuthContext'
import { t } from '@/i18n'
import { MeshRulesEditor, type MeshRule } from './MeshRulesEditor'


const MODEL_VIEWER_CDN = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'

function loadModelViewer() {
  if (customElements.get('model-viewer')) return
  const s = document.createElement('script')
  s.type = 'module'
  s.src = MODEL_VIEWER_CDN
  document.head.appendChild(s)
}

function ModelViewerThumb({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const mv = document.createElement('model-viewer')
    mv.setAttribute('src', src)
    mv.setAttribute('auto-rotate', '')
    mv.style.width = '100%'
    mv.style.height = '100%'
    container.appendChild(mv)
    return () => { container.innerHTML = '' }
  }, [src])

  return <div ref={containerRef} className="w-full h-full" />
}

interface Props {
  productId:            string
  arEnabled?:           boolean
  onArToggle?:          (v: boolean) => Promise<void>
  arPlacement?:         'floor' | 'wall'
  onArPlacementChange?: (placement: 'floor' | 'wall') => Promise<void>
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  image: 'Image',
  render: 'Render',
  '3d_model': '3D Model',
}

interface AddFormState {
  url: string
  asset_type: AssetType
  characteristic_value_id: string
  is_default: boolean
  uploadMode: 'url' | 'file'
  file: File | null
  uploading: boolean
}

const emptyForm = (): AddFormState => ({
  url: '',
  asset_type: 'image',
  characteristic_value_id: '',
  is_default: false,
  uploadMode: 'url',
  file: null,
  uploading: false,
})

export function VisualizationPanel({ productId, arEnabled = true, onArToggle, arPlacement = 'floor', onArPlacementChange }: Props) {
  const { tenant, planLimits } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<VisualizationAsset[]>([])
  const [chars, setChars] = useState<CharacteristicWithValues[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<AddFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<VisualizationAsset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [meshEditorAssetId, setMeshEditorAssetId] = useState<string | null>(null)
  const [arToggling, setArToggling] = useState(false)
  // Mesh names parsed client-side from the selected GLB file before upload
  const [pendingMeshNames, setPendingMeshNames] = useState<string[]>([])

  useEffect(() => {
    load()
  }, [productId])

  useEffect(() => {
    if (assets.some(a => a.asset_type === '3d_model')) loadModelViewer()
  }, [assets])

  async function load() {
    setLoading(true)
    try {
      const [assetData, charsData] = await Promise.all([
        fetchAssetsForProduct(productId),
        fetchProductCharacteristicsWithValues(productId),
      ])
      setAssets(assetData)
      setChars(charsData)
    } catch {
      toast({ title: 'Failed to load visualization assets', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const allValues = chars.flatMap(c =>
    c.characteristic_values.map(v => ({
      id: v.id,
      label: `${c.name} → ${v.label}`,
    }))
  )

  const formIsDefault =
    form.characteristic_value_id === '' ? true : form.is_default

  async function handleAdd() {
    const url = form.url.trim()
    if (!url) {
      toast({ title: t('Enter a URL first'), variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const created = await createAsset({
        product_id: productId,
        characteristic_value_id: form.characteristic_value_id || null,
        asset_type: form.asset_type,
        url,
        is_default: formIsDefault,
        sort_order: assets.length,
      })
      setAssets(prev => [...prev, created])
      setForm(emptyForm())
      setShowAddForm(false)
      toast({ title: t('Asset added') })
    } catch (e) {
      toast({
        title: t('Failed to add asset'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload() {
    if (!form.file || !tenant) return
    setForm(f => ({ ...f, uploading: true }))
    try {
      const publicUrl = await uploadAssetFile(tenant.id, productId, form.file)
      const isDefault = form.characteristic_value_id === '' ? true : form.is_default
      const created = await createAsset({
        product_id: productId,
        characteristic_value_id: form.characteristic_value_id || null,
        asset_type: form.asset_type,
        url: publicUrl,
        is_default: isDefault,
        sort_order: assets.length,
      })
      setAssets(prev => [...prev, created])
      setForm(emptyForm())
      setShowAddForm(false)
      toast({ title: t('Asset uploaded and saved') })
      // Auto-open mesh rules editor for newly uploaded 3D models
      if (created.asset_type === '3d_model') {
        setMeshEditorAssetId(created.id)
      }
    } catch (e) {
      setForm(f => ({ ...f, uploading: false }))
      toast({
        title: t('Upload failed'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function handleToggleDefault(asset: VisualizationAsset) {
    try {
      const updated = await updateAsset(asset.id, { is_default: !asset.is_default })
      setAssets(prev => prev.map(a => a.id === asset.id ? updated : a))
    } catch {
      toast({ title: t('Failed to update asset'), variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteAsset(toDelete.id)
      setAssets(prev => prev.filter(a => a.id !== toDelete.id))
      setToDelete(null)
      toast({ title: 'Asset deleted' })
    } catch {
      toast({ title: t('Failed to delete asset'), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleMove(asset: VisualizationAsset, direction: 'up' | 'down') {
    const idx = assets.findIndex(a => a.id === asset.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === assets.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const next = [...assets]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]

    const reordered = next.map((a, i) => ({ ...a, sort_order: i }))
    setAssets(reordered)

    try {
      await reorderAssets(reordered.map(a => ({ id: a.id, sort_order: a.sort_order })))
    } catch {
      setAssets(assets)
      toast({ title: t('Failed to reorder'), variant: 'destructive' })
    }
  }

  async function handleSaveMeshRules(assetId: string, rules: MeshRule[]) {
    try {
      const updated = await updateAsset(assetId, { mesh_rules: rules as unknown as import('@/types/database').Json })
      setAssets(prev => prev.map(a => a.id === assetId ? updated : a))
      toast({ title: t('Mesh rules saved') })
      setMeshEditorAssetId(null)
    } catch {
      toast({ title: t('Failed to save mesh rules'), variant: 'destructive' })
    }
  }

  function valueLabel(cvId: string | null): string {
    if (!cvId) return t('Default')
    return allValues.find(v => v.id === cvId)?.label ?? cvId.slice(0, 8)
  }

  function meshRulesCount(asset: VisualizationAsset): number {
    if (!Array.isArray(asset.mesh_rules)) return 0
    return (asset.mesh_rules as MeshRule[]).length
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      {/* Asset list */}
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {t('No visualization assets yet. Add one below.')}
        </p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset, idx) => (
            <div key={asset.id}>
              <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
                {/* Thumbnail */}
                <div className="h-12 w-16 shrink-0 rounded overflow-hidden border bg-muted flex items-center justify-center">
                  {asset.asset_type === '3d_model' ? (
                    <ModelViewerThumb src={asset.url} />
                  ) : (
                    <img
                      src={asset.url}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {t(ASSET_TYPE_LABELS[asset.asset_type])}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {valueLabel(asset.characteristic_value_id)}
                    </span>
                    {asset.is_default && (
                      <Badge variant="success" className="text-xs">{t('Default')}</Badge>
                    )}
                    {asset.asset_type === '3d_model' && meshRulesCount(asset) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {meshRulesCount(asset)} {t('mesh rules')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                    {asset.url}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {asset.asset_type === '3d_model' && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title={t('Configure mesh rules')}
                      onClick={() => setMeshEditorAssetId(meshEditorAssetId === asset.id ? null : asset.id)}
                    >
                      <Network className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title={asset.is_default ? t('Unset default') : t('Set as default')}
                    onClick={() => handleToggleDefault(asset)}
                  >
                    {asset.is_default
                      ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title={t('Move up')} disabled={idx === 0}
                    onClick={() => handleMove(asset, 'up')}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title={t('Move down')} disabled={idx === assets.length - 1}
                    onClick={() => handleMove(asset, 'down')}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title={t('Delete')}
                    onClick={() => setToDelete(asset)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Inline mesh rules editor */}
              {asset.asset_type === '3d_model' && meshEditorAssetId === asset.id && (
                <MeshRulesEditor
                  assetId={asset.id}
                  assetUrl={asset.url}
                  initialRules={(Array.isArray(asset.mesh_rules) ? asset.mesh_rules : []) as MeshRule[]}
                  initialMeshNames={pendingMeshNames}
                  characteristics={chars}
                  onSave={rules => handleSaveMeshRules(asset.id, rules)}
                  onClose={() => { setMeshEditorAssetId(null); setPendingMeshNames([]) }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">{t('Add visualization asset')}</p>

          {/* URL / File toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, uploadMode: 'url' }))}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                form.uploadMode === 'url'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              <Link className="h-3 w-3" /> {t('Paste URL')}
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, uploadMode: 'file' }))}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                form.uploadMode === 'file'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              <Upload className="h-3 w-3" /> {t('Upload file')}
            </button>
          </div>

          {form.uploadMode === 'url' ? (
            <Input
              placeholder={t('https://example.com/image.jpg')}
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            />
          ) : (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,.glb,.gltf"
                className="text-sm"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  const is3d = !!file && /\.(glb|gltf)$/i.test(file.name)
                  setForm(f => ({
                    ...f,
                    file,
                    asset_type: is3d ? '3d_model' : f.asset_type,
                  }))
                  if (is3d && file) {
                    setPendingMeshNames([])
                    parseMeshNames(file)
                      .then(names => setPendingMeshNames(names))
                      .catch(() => {})
                  } else {
                    setPendingMeshNames([])
                  }
                }}
              />
              {form.file && (
                <Button
                  size="sm" variant="outline"
                  loading={form.uploading}
                  onClick={handleUpload}
                >
                  {t('Upload and save')}
                </Button>
              )}
              {form.url && (
                <p className="text-xs text-emerald-600 font-mono truncate">{form.url}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Asset type */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('Type')}</label>
              <Select
                value={form.asset_type}
                onChange={e => setForm(f => ({ ...f, asset_type: e.target.value as AssetType }))}
              >
                <option value="image">{t('Image')}</option>
                <option value="render">{t('Render')}</option>
                <option value="3d_model">{t('3D Model')}</option>
              </Select>
            </div>

            {/* Attach to value */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('Attach to value')}</label>
              <Select
                value={form.characteristic_value_id}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    characteristic_value_id: e.target.value,
                    is_default: e.target.value === '' ? true : f.is_default,
                  }))
                }
              >
                <option value="">{t('Default (no specific value)')}</option>
                {allValues.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* is_default checkbox — only shown when a value is selected */}
          {form.characteristic_value_id !== '' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="rounded border-input"
              />
              {t('Also use as default fallback')}
            </label>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} loading={saving} disabled={!form.url.trim()}>
              {t('Add asset')}
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => { setShowAddForm(false); setForm(emptyForm()) }}
            >
              {t('Cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('Add visualization asset')}
        </button>
      )}

      {/* AR toggle — shown only when the plan includes 3D and there are 3D assets */}
      {planLimits?.three_d && assets.some(a => a.asset_type === '3d_model') && onArToggle && (
        <div className="pt-2 border-t">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={arEnabled}
              disabled={arToggling}
              onClick={async () => {
                setArToggling(true)
                try { await onArToggle(!arEnabled) } finally { setArToggling(false) }
              }}
              className={[
                'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                arEnabled ? 'bg-primary' : 'bg-input',
                arToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className={[
                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                arEnabled ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')} />
            </button>
            <span className="text-sm">
              {t('Enable AR (augmented reality) button on 3D model')}
            </span>
          </label>

          {/* Surface placement — only meaningful when AR is on */}
          {arEnabled && onArPlacementChange && (
            <div className="flex items-center gap-3 mt-3 ml-12">
              <span className="text-sm text-muted-foreground shrink-0">{t('Surface type')}:</span>
              <div className="flex rounded-md border overflow-hidden text-xs font-medium">
                {(['floor', 'wall'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onArPlacementChange(p)}
                    className={[
                      'px-3 py-1.5 transition-colors',
                      arPlacement === p
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted text-foreground',
                      p === 'wall' ? 'border-l' : '',
                    ].join(' ')}
                  >
                    {p === 'floor' ? t('Floor') : t('Wall')}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {arPlacement === 'wall'
                  ? t('For windows, paintings, shelves')
                  : t('For furniture, appliances')}
              </span>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title={t('Delete asset?')}
        description={t('This will remove the asset. The image file itself (if hosted externally) will not be deleted.')}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
