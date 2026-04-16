import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import {
  fetchCharacteristics,
  fetchProductCharacteristics,
  fetchValuesForCharacteristic,
  attachCharacteristicToProduct,
  detachCharacteristicFromProduct,
  createCharacteristic,
  fetchClasses,
  createClass,
  setCharacteristicClass,
} from '@/lib/products'
import type {
  Characteristic,
  CharacteristicValue,
  CharacteristicClass,
  ProductCharacteristic,
} from '@/types/database'
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

  const [loading, setLoading]     = useState(true)
  const [attached, setAttached]   = useState<AttachedChar[]>([])
  const [library, setLibrary]     = useState<Characteristic[]>([])
  const [classes, setClasses]     = useState<CharacteristicClass[]>([])
  const [values, setValues]       = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})

  // Add existing characteristic
  const [selectedCharId, setSelectedCharId] = useState('')
  const [attaching, setAttaching]           = useState(false)

  // Create new characteristic inline
  const [showNewChar, setShowNewChar]       = useState(false)
  const [newCharName, setNewCharName]       = useState('')
  const [newCharType, setNewCharType]       = useState<Characteristic['display_type']>('select')
  const [creatingChar, setCreatingChar]     = useState(false)

  // Class management
  const [showNewClass, setShowNewClass]     = useState(false)
  const [newClassName, setNewClassName]     = useState('')
  const [creatingClass, setCreatingClass]   = useState(false)

  // Detach confirmation
  const [toDetach, setToDetach]   = useState<AttachedChar | null>(null)
  const [detaching, setDetaching] = useState(false)

  useEffect(() => {
    load()
  }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [attachedData, libData, classData] = await Promise.all([
        fetchProductCharacteristics(productId),
        fetchCharacteristics(),
        fetchClasses(),
      ])
      setAttached(attachedData)
      setLibrary(libData)
      setClasses(classData)

      const valMap: Record<string, CharacteristicValue[]> = {}
      await Promise.all(
        attachedData.map(async a => {
          valMap[a.characteristic_id] = await fetchValuesForCharacteristic(a.characteristic_id)
        })
      )
      setValues(valMap)

      if (attachedData.length > 0) {
        setExpanded({ [attachedData[0].characteristic_id]: true })
      }
    } catch {
      toast({ title: 'Failed to load characteristics', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const unattached = library.filter(c => !attached.some(a => a.characteristic_id === c.id))

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

  async function handleCreateClass() {
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const created = await createClass({ name: newClassName.trim() })
      setClasses(prev => [...prev, created])
      setNewClassName('')
      setShowNewClass(false)
      toast({ title: `Class "${created.name}" created` })
    } catch {
      toast({ title: 'Failed to create class', variant: 'destructive' })
    } finally {
      setCreatingClass(false)
    }
  }

  async function handleAssignClass(charId: string, classId: string) {
    try {
      await setCharacteristicClass(charId, classId === '' ? null : classId)
      setLibrary(prev => prev.map(c => c.id === charId ? { ...c, class_id: classId === '' ? null : classId } : c))
      setAttached(prev => prev.map(a =>
        a.characteristic_id === charId
          ? { ...a, characteristic: { ...a.characteristic, class_id: classId === '' ? null : classId } }
          : a
      ))
    } catch {
      toast({ title: 'Failed to assign class', variant: 'destructive' })
    }
  }

  function toggleExpand(charId: string) {
    setExpanded(prev => ({ ...prev, [charId]: !prev[charId] }))
  }

  // Group attached characteristics by class
  const grouped: { class: CharacteristicClass | null; items: AttachedChar[] }[] = []
  const usedClassIds = new Set<string | null>()

  for (const a of attached) {
    const classId = a.characteristic.class_id ?? null
    if (!usedClassIds.has(classId)) {
      usedClassIds.add(classId)
      const cls = classes.find(c => c.id === classId) ?? null
      grouped.push({ class: cls, items: [] })
    }
    grouped.find(g => (g.class?.id ?? null) === classId)!.items.push(a)
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-4">

      {/* ── Class manager ─────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/10 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Classes
          </div>
          {!showNewClass && (
            <button
              type="button"
              onClick={() => setShowNewClass(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" /> New class
            </button>
          )}
        </div>

        {classes.length === 0 && !showNewClass && (
          <p className="text-xs text-muted-foreground">No classes yet. Create one to group characteristics.</p>
        )}

        {classes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {classes.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
              >
                {c.name}
              </span>
            ))}
          </div>
        )}

        {showNewClass && (
          <div className="flex gap-2 items-center pt-1">
            <Input
              placeholder="Class name (e.g. Dimensions, Material)"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              autoFocus
              className="text-sm flex-1"
            />
            <Button size="sm" onClick={handleCreateClass} loading={creatingClass} disabled={!newClassName.trim()}>
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNewClass(false); setNewClassName('') }}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* ── Attached characteristics grouped by class ─────────────────── */}
      {attached.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No characteristics yet. Add one below.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.class?.id ?? 'unclassified'}>
              {/* Class header (only when classes exist) */}
              {classes.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.class?.name ?? 'Unclassified'}
                  </span>
                  <div className="flex-1 border-t" />
                </div>
              )}

              <div className="space-y-2">
                {group.items.map(a => (
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

                    {/* Expanded */}
                    {expanded[a.characteristic_id] && (
                      <div className="px-4 pb-4 pt-2 border-t bg-muted/10 space-y-3">
                        {/* Assign class */}
                        {classes.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-12">Class</span>
                            <Select
                              value={a.characteristic.class_id ?? ''}
                              onChange={e => handleAssignClass(a.characteristic_id, e.target.value)}
                              className="text-xs h-7 py-0"
                            >
                              <option value="">Unclassified</option>
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </Select>
                          </div>
                        )}

                        {/* Values editor */}
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
            </div>
          ))}
        </div>
      )}

      {/* ── Add existing characteristic ────────────────────────────────── */}
      {unattached.length > 0 && !showNewChar && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Select
              value={selectedCharId}
              onChange={e => setSelectedCharId(e.target.value)}
            >
              <option value="">Add existing characteristic…</option>
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

      {/* ── Create new characteristic ──────────────────────────────────── */}
      {showNewChar ? (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">New characteristic</p>
          <div className="flex gap-2">
            <Input
              placeholder="Name (e.g. Material, Size, Width)"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              autoFocus
              className="flex-1"
            />
            <Select
              value={newCharType}
              onChange={e => setNewCharType(e.target.value as Characteristic['display_type'])}
              className="w-36"
            >
              <option value="select">Select</option>
              <option value="radio">Radio</option>
              <option value="swatch">Swatch</option>
              <option value="toggle">Toggle</option>
              <option value="number">Number input</option>
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
