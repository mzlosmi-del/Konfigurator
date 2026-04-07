import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import {
  fetchCharacteristics,
  fetchProductCharacteristics,
  fetchValuesForCharacteristic,
  attachCharacteristicToProduct,
  detachCharacteristicFromProduct,
  createCharacteristic,
} from '@/lib/products'
import type { Characteristic, CharacteristicValue, ProductCharacteristic } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CharacteristicValuesEditor } from './CharacteristicValuesEditor'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useAuthContext } from '@/components/auth/AuthContext'

type AttachedChar = ProductCharacteristic & { characteristic: Characteristic }

interface Props {
  productId: string
}

export function CharacteristicsPanel({ productId }: Props) {
  const { tenant } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading] = useState(true)
  const [attached, setAttached] = useState<AttachedChar[]>([])
  const [library, setLibrary] = useState<Characteristic[]>([])
  const [values, setValues] = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Add existing characteristic
  const [selectedCharId, setSelectedCharId] = useState('')
  const [attaching, setAttaching] = useState(false)

  // Create new characteristic inline
  const [showNewChar, setShowNewChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharType, setNewCharType] = useState<Characteristic['display_type']>('select')
  const [creatingChar, setCreatingChar] = useState(false)

  // Detach confirmation
  const [toDetach, setToDetach] = useState<AttachedChar | null>(null)
  const [detaching, setDetaching] = useState(false)

  useEffect(() => {
    load()
  }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [attachedData, libData] = await Promise.all([
        fetchProductCharacteristics(productId),
        fetchCharacteristics(),
      ])
      setAttached(attachedData)
      setLibrary(libData)

      // Load values for all attached characteristics
      const valMap: Record<string, CharacteristicValue[]> = {}
      await Promise.all(
        attachedData.map(async a => {
          valMap[a.characteristic_id] = await fetchValuesForCharacteristic(a.characteristic_id)
        })
      )
      setValues(valMap)

      // Expand first characteristic by default
      if (attachedData.length > 0) {
        setExpanded({ [attachedData[0].characteristic_id]: true })
      }
    } catch {
      toast({ title: 'Failed to load characteristics', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Characteristics not yet attached to this product
  const unattached = library.filter(
    c => !attached.some(a => a.characteristic_id === c.id)
  )

  async function handleAttach() {
    if (!selectedCharId) return
    setAttaching(true)
    try {
      await attachCharacteristicToProduct(productId, selectedCharId, attached.length)
      const vals = await fetchValuesForCharacteristic(selectedCharId)
      await load()
      setValues(prev => ({ ...prev, [selectedCharId]: vals }))
      setExpanded(prev => ({ ...prev, [selectedCharId]: true }))
      setSelectedCharId('')
    } catch {
      toast({ title: 'Failed to attach characteristic', variant: 'destructive' })
    } finally {
      setAttaching(false)
    }
  }

  async function handleCreateAndAttach() {
    if (!newCharName.trim()) return
    setCreatingChar(true)
    try {
      const created = await createCharacteristic({ name: newCharName.trim(), display_type: newCharType })
      setLibrary(prev => [...prev, created])
      await attachCharacteristicToProduct(productId, created.id, attached.length)
      setValues(prev => ({ ...prev, [created.id]: [] }))
      await load()
      setExpanded(prev => ({ ...prev, [created.id]: true }))
      setNewCharName('')
      setNewCharType('select')
      setShowNewChar(false)
    } catch {
      toast({ title: 'Failed to create characteristic', variant: 'destructive' })
    } finally {
      setCreatingChar(false)
    }
  }

  async function handleDetach() {
    if (!toDetach) return
    setDetaching(true)
    try {
      await detachCharacteristicFromProduct(productId, toDetach.characteristic_id)
      setAttached(prev => prev.filter(a => a.characteristic_id !== toDetach.characteristic_id))
      setToDetach(null)
    } catch {
      toast({ title: 'Failed to remove characteristic', variant: 'destructive' })
    } finally {
      setDetaching(false)
    }
  }

  function toggleExpand(charId: string) {
    setExpanded(prev => ({ ...prev, [charId]: !prev[charId] }))
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-3">
      {/* Attached characteristics */}
      {attached.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No characteristics yet. Add one below.
        </p>
      ) : (
        <div className="space-y-2">
          {attached.map(a => (
            <div key={a.characteristic_id} className="rounded-lg border bg-card overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(a.characteristic_id)}
              >
                {expanded[a.characteristic_id]
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="font-medium text-sm flex-1">{a.characteristic.name}</span>
                <span className="text-xs text-muted-foreground capitalize px-2 py-0.5 rounded bg-muted">
                  {a.characteristic.display_type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(values[a.characteristic_id] ?? []).length} values
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive ml-1"
                  onClick={e => { e.stopPropagation(); setToDetach(a) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Expanded: values editor */}
              {expanded[a.characteristic_id] && (
                <div className="px-4 pb-4 pt-1 border-t bg-muted/10">
                  {tenant && (
                    <CharacteristicValuesEditor
                      characteristicId={a.characteristic_id}
                      tenantId={tenant.id}
                      values={values[a.characteristic_id] ?? []}
                      onChange={updated =>
                        setValues(prev => ({ ...prev, [a.characteristic_id]: updated }))
                      }
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add existing characteristic */}
      {unattached.length > 0 && !showNewChar && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Select
              value={selectedCharId}
              onChange={e => setSelectedCharId(e.target.value)}
            >
              <option value="">Select existing characteristic…</option>
              {unattached.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAttach}
            disabled={!selectedCharId}
            loading={attaching}
          >
            Add
          </Button>
        </div>
      )}

      {/* Create new characteristic */}
      {showNewChar ? (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">New characteristic</p>
          <div className="flex gap-2">
            <Input
              placeholder="Name (e.g. Material, Size, Color)"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              autoFocus
              className="flex-1"
            />
            <Select
              value={newCharType}
              onChange={e => setNewCharType(e.target.value as Characteristic['display_type'])}
              className="w-32"
            >
              <option value="select">Select</option>
              <option value="radio">Radio</option>
              <option value="swatch">Swatch</option>
              <option value="toggle">Toggle</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateAndAttach} loading={creatingChar} disabled={!newCharName.trim()}>
              Create & add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNewChar(false); setNewCharName('') }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewChar(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create new characteristic
        </button>
      )}

      <ConfirmDialog
        open={!!toDetach}
        onOpenChange={open => !open && setToDetach(null)}
        title="Remove characteristic?"
        description={`Remove "${toDetach?.characteristic.name}" from this product? The characteristic and its values will not be deleted from your library.`}
        confirmLabel="Remove"
        onConfirm={handleDetach}
        loading={detaching}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
