import { useEffect, useState } from 'react'
import { Plus, Trash2, Star, StarOff, Upload, Link, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchAssetsForProduct,
  createAsset,
  updateAsset,
  deleteAsset,
  reorderAssets,
  uploadAssetFile,
} from '@/lib/assets'
import { fetchProductCharacteristics } from '@/lib/products'
import type { VisualizationAsset, AssetType, ProductCharacteristic, Characteristic } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useAuthContext } from '@/components/auth/AuthContext'

type AttachedChar = ProductCharacteristic & {
  characteristic: Characteristic & { values: { id: string; label: string }[] }
}

interface Props {
  productId: string
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  image: 'Image',
  render: 'Render',
  '3d_model': '3D Model',
}

// ─── Add asset form ───────────────────────────────────────────────────────────

interface AddFormState {
  url: string
  asset_type: AssetType
  characteristic_value_id: string   // '' = default
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

// ─── Component ────────────────────────────────────────────────────────────────

export function VisualizationPanel({ productId }: Props) {
  const { tenant } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<VisualizationAsset[]>([])
  const [chars, setChars] = useState<AttachedChar[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<AddFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<VisualizationAsset | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    load()
  }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [assetData, charData] = await Promise.all([
        fetchAssetsForProduct(productId),
        fetchProductCharacteristics(productId),
      ])
      setAssets(assetData)
      // Fetch values for each characteristic for the "attach to value" dropdown
      const fullChars: AttachedChar[] = await Promise.all(
        charData.map(async (pc) => {
          const { data: vals } = await supabase
            .from('characteristic_values')
            .select('id, label')
            .eq('characteristic_id', pc.characteristic_id)
            .order('sort_order', { ascending: true })
          return {
            ...pc,
            characteristic: {
              ...(pc as any).characteristic,
              values: vals ?? [],
            },
          } as AttachedChar
        })
      )
      setChars(fullChars)
    } catch {
      toast({ title: 'Failed to load visualization assets', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ── All char values flattened for the dropdown ──────────────────────────────
  const allValues = chars.flatMap(pc =>
    pc.characteristic.values.map(v => ({
      id: v.id,
      label: `${pc.characteristic.name} → ${v.label}`,
    }))
  )

  // ── Derived: should is_default be forced true? ──────────────────────────────
  // If no value selected, this must be a default asset
  const formIsDefault =
    form.characteristic_value_id === '' ? true : form.is_default

  // ── Add asset ───────────────────────────────────────────────────────────────
  async function handleAdd() {
    const url = form.url.trim()
    if (!url) {
      toast({ title: 'Enter a URL first', variant: 'destructive' })
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
      toast({ title: 'Asset added' })
    } catch (e) {
      toast({
        title: 'Failed to add asset',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Upload file → Supabase Storage ─────────────────────────────────────────
  async function handleUpload() {
    if (!form.file || !tenant) return
    setForm(f => ({ ...f, uploading: true }))
    try {
      const publicUrl = await uploadAssetFile(tenant.id, productId, form.file)
      setForm(f => ({ ...f, url: publicUrl, uploading: false }))
      toast({ title: 'File uploaded — click Add to save' })
    } catch (e) {
      setForm(f => ({ ...f, uploading: false }))
      toast({
        title: 'Upload failed',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  // ── Toggle default ──────────────────────────────────────────────────────────
  async function handleToggleDefault(asset: VisualizationAsset) {
    try {
      const updated = await updateAsset(asset.id, { is_default: !asset.is_default })
      setAssets(prev => prev.map(a => a.id === asset.id ? updated : a))
    } catch {
      toast({ title: 'Failed to update asset', variant: 'destructive' })
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteAsset(toDelete.id)
      setAssets(prev => prev.filter(a => a.id !== toDelete.id))
      setToDelete(null)
      toast({ title: 'Asset deleted' })
    } catch {
      toast({ title: 'Failed to delete asset', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Reorder ─────────────────────────────────────────────────────────────────
  async function handleMove(asset: VisualizationAsset, direction: 'up' | 'down') {
    const idx = assets.findIndex(a => a.id === asset.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === assets.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const next = [...assets]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]

    const reordered = next.map((a, i) => ({ ...a, sort_order: i }))
    setAssets(reordered) // optimistic

    try {
      await reorderAssets(reordered.map(a => ({ id: a.id, sort_order: a.sort_order })))
    } catch {
      setAssets(assets) // revert
      toast({ title: 'Failed to reorder', variant: 'destructive' })
    }
  }

  // ── Resolve label for a characteristic_value_id ─────────────────────────────
  function valueLabel(cvId: string | null): string {
    if (!cvId) return 'Default'
    return allValues.find(v => v.id === cvId)?.label ?? cvId.slice(0, 8)
  }

  // ────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      {/* Asset list */}
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No visualization assets yet. Add one below.
        </p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset, idx) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
            >
              {/* Thumbnail */}
              <div className="h-12 w-16 shrink-0 rounded overflow-hidden border bg-muted flex items-center justify-center">
                {(asset.asset_type === 'image' || asset.asset_type === 'render') ? (
                  <img
                    src={asset.url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground font-mono">3D</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {ASSET_TYPE_LABELS[asset.asset_type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {valueLabel(asset.characteristic_value_id)}
                  </span>
                  {asset.is_default && (
                    <Badge variant="success" className="text-xs">Default</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                  {asset.url}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  title={asset.is_default ? 'Unset default' : 'Set as default'}
                  onClick={() => handleToggleDefault(asset)}
                >
                  {asset.is_default
                    ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  title="Move up" disabled={idx === 0}
                  onClick={() => handleMove(asset, 'up')}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  title="Move down" disabled={idx === assets.length - 1}
                  onClick={() => handleMove(asset, 'down')}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  title="Delete"
                  onClick={() => setToDelete(asset)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">Add asset</p>

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
              <Link className="h-3 w-3" /> Paste URL
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
              <Upload className="h-3 w-3" /> Upload file
            </button>
          </div>

          {form.uploadMode === 'url' ? (
            <Input
              placeholder="https://example.com/image.jpg"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            />
          ) : (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,.glb,.gltf"
                className="text-sm"
                onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
              />
              {form.file && (
                <Button
                  size="sm" variant="outline"
                  loading={form.uploading}
                  onClick={handleUpload}
                >
                  Upload to storage
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
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select
                value={form.asset_type}
                onChange={e => setForm(f => ({ ...f, asset_type: e.target.value as AssetType }))}
              >
                <option value="image">Image</option>
                <option value="render">Render</option>
                <option value="3d_model">3D Model</option>
              </Select>
            </div>

            {/* Attach to value */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Attach to value</label>
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
                <option value="">Default (no specific value)</option>
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
              Also use as default fallback
            </label>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} loading={saving} disabled={!form.url.trim()}>
              Add asset
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => { setShowAddForm(false); setForm(emptyForm()) }}
            >
              Cancel
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
          Add visualization asset
        </button>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Delete asset?"
        description="This will remove the asset. The image file itself (if hosted externally) will not be deleted."
        onConfirm={handleDelete}
        loading={deleting}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
