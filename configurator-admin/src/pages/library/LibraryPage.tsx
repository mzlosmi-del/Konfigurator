import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import {
  fetchCharacteristics,
  createCharacteristic,
  updateCharacteristic,
  deleteCharacteristic,
  fetchClasses,
  createClass,
  deleteClass,
  setCharacteristicClass,
  fetchValuesForCharacteristic,
} from '@/lib/products'
import type { Characteristic, CharacteristicClass, CharacteristicValue } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CharacteristicValuesEditor } from '@/pages/products/components/CharacteristicValuesEditor'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useAuthContext } from '@/components/auth/AuthContext'

export function LibraryPage() {
  const { tenant } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]           = useState(true)
  const [characteristics, setChars]     = useState<Characteristic[]>([])
  const [classes, setClasses]           = useState<CharacteristicClass[]>([])
  const [values, setValues]             = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({})

  // New characteristic form
  const [showNewChar, setShowNewChar]   = useState(false)
  const [newName, setNewName]           = useState('')
  const [newType, setNewType]           = useState<Characteristic['display_type']>('select')
  const [newClassId, setNewClassId]     = useState('')
  const [creatingChar, setCreatingChar] = useState(false)

  // New class form
  const [showNewClass, setShowNewClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [creatingClass, setCreatingClass] = useState(false)

  // Delete confirmations
  const [toDelete, setToDelete]         = useState<Characteristic | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [toDeleteClass, setToDeleteClass] = useState<CharacteristicClass | null>(null)
  const [deletingClass, setDeletingClass] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [chars, cls] = await Promise.all([fetchCharacteristics(), fetchClasses()])
      setChars(chars)
      setClasses(cls)
      const valMap: Record<string, CharacteristicValue[]> = {}
      await Promise.all(chars.map(async c => {
        valMap[c.id] = await fetchValuesForCharacteristic(c.id)
      }))
      setValues(valMap)
    } catch {
      toast({ title: 'Failed to load library', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Characteristic CRUD ──────────────────────────────────────────────────────

  async function handleCreateChar() {
    if (!newName.trim()) return
    setCreatingChar(true)
    try {
      const created = await createCharacteristic({ name: newName.trim(), display_type: newType })
      if (newClassId) await setCharacteristicClass(created.id, newClassId)
      const withClass = { ...created, class_id: newClassId || null }
      setChars(prev => [...prev, withClass])
      setValues(prev => ({ ...prev, [created.id]: [] }))
      setNewName(''); setNewType('select'); setNewClassId(''); setShowNewChar(false)
    } catch {
      toast({ title: 'Failed to create characteristic', variant: 'destructive' })
    } finally {
      setCreatingChar(false)
    }
  }

  async function handleRenameChar(char: Characteristic, name: string) {
    if (!name.trim() || name === char.name) return
    try {
      const updated = await updateCharacteristic(char.id, { name: name.trim() })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: 'Failed to rename characteristic', variant: 'destructive' })
    }
  }

  async function handleChangeType(char: Characteristic, display_type: Characteristic['display_type']) {
    try {
      const updated = await updateCharacteristic(char.id, { display_type })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: 'Failed to update type', variant: 'destructive' })
    }
  }

  async function handleChangeClass(char: Characteristic, classId: string) {
    try {
      await setCharacteristicClass(char.id, classId || null)
      setChars(prev => prev.map(c => c.id === char.id ? { ...c, class_id: classId || null } : c))
    } catch {
      toast({ title: 'Failed to update class', variant: 'destructive' })
    }
  }

  async function handleDeleteChar() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteCharacteristic(toDelete.id)
      setChars(prev => prev.filter(c => c.id !== toDelete.id))
      setToDelete(null)
    } catch {
      toast({ title: 'Failed to delete characteristic', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Class CRUD ───────────────────────────────────────────────────────────────

  async function handleCreateClass() {
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const created = await createClass({ name: newClassName.trim() })
      setClasses(prev => [...prev, created])
      setNewClassName(''); setShowNewClass(false)
    } catch {
      toast({ title: 'Failed to create class', variant: 'destructive' })
    } finally {
      setCreatingClass(false)
    }
  }

  async function handleDeleteClass() {
    if (!toDeleteClass) return
    setDeletingClass(true)
    try {
      await deleteClass(toDeleteClass.id)
      setClasses(prev => prev.filter(c => c.id !== toDeleteClass.id))
      // Unassign characteristics that belonged to this class
      setChars(prev => prev.map(c => c.class_id === toDeleteClass.id ? { ...c, class_id: null } : c))
      setToDeleteClass(null)
    } catch {
      toast({ title: 'Failed to delete class', variant: 'destructive' })
    } finally {
      setDeletingClass(false)
    }
  }

  // ── Group characteristics by class ──────────────────────────────────────────

  const unclassified = characteristics.filter(c => !c.class_id)
  const byClass = classes.map(cls => ({
    cls,
    items: characteristics.filter(c => c.class_id === cls.id),
  }))

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Characteristic Library"
        description="Manage all characteristics and classes available across your products."
      />

      <div className="p-6 space-y-6 max-w-4xl">

        {/* ── Classes ──────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  Classes
                </CardTitle>
                <CardDescription className="mt-1">
                  Group related characteristics into named sections.
                </CardDescription>
              </div>
              {!showNewClass && (
                <Button size="sm" variant="outline" onClick={() => setShowNewClass(true)}>
                  <Plus className="h-4 w-4" />
                  New class
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length === 0 && !showNewClass && (
              <p className="text-sm text-muted-foreground">No classes yet.</p>
            )}

            {classes.length > 0 && (
              <div className="space-y-1.5">
                {classes.map(cls => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                      >
                        {cls.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {characteristics.filter(c => c.class_id === cls.id).length} characteristics
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setToDeleteClass(cls)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showNewClass && (
              <div className="flex gap-2 items-center pt-1">
                <Input
                  placeholder="Class name (e.g. Dimensions, Material)"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateClass() }}
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
          </CardContent>
        </Card>

        {/* ── Characteristics ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Characteristics</CardTitle>
                <CardDescription className="mt-1">
                  Define the configurable options customers can choose from.
                </CardDescription>
              </div>
              {!showNewChar && (
                <Button size="sm" variant="outline" onClick={() => setShowNewChar(true)}>
                  <Plus className="h-4 w-4" />
                  New characteristic
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* New characteristic form */}
            {showNewChar && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                <p className="text-sm font-medium">New characteristic</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Name (e.g. Material, Width)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateChar() }}
                    autoFocus
                    className="flex-1"
                  />
                  <Select
                    value={newType}
                    onChange={e => setNewType(e.target.value as Characteristic['display_type'])}
                    className="w-36"
                  >
                    <option value="select">Select</option>
                    <option value="radio">Radio</option>
                    <option value="swatch">Swatch</option>
                    <option value="toggle">Toggle</option>
                    <option value="number">Number input</option>
                  </Select>
                  {classes.length > 0 && (
                    <Select
                      value={newClassId}
                      onChange={e => setNewClassId(e.target.value)}
                      className="w-40"
                    >
                      <option value="">No class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateChar} loading={creatingChar} disabled={!newName.trim()}>
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowNewChar(false); setNewName('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {characteristics.length === 0 && !showNewChar && (
              <p className="text-sm text-muted-foreground">No characteristics yet.</p>
            )}

            {/* Render by class groups, then unclassified */}
            {[...byClass.filter(g => g.items.length > 0), ...(unclassified.length > 0 ? [{ cls: null, items: unclassified }] : [])].map(group => (
              <div key={group.cls?.id ?? 'unclassified'}>
                {/* Group header — only show when classes exist */}
                {classes.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.cls?.name ?? 'Unclassified'}
                    </span>
                    <div className="flex-1 border-t" />
                  </div>
                )}

                <div className="space-y-1.5">
                  {group.items.map(char => (
                    <div key={char.id} className="rounded-lg border bg-card overflow-hidden">
                      {/* Row */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(char.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {expanded[char.id]
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </button>

                        {/* Editable name */}
                        <input
                          className="flex-1 bg-transparent text-sm font-medium outline-none focus:ring-0 min-w-0"
                          defaultValue={char.name}
                          onBlur={e => handleRenameChar(char, e.target.value)}
                        />

                        {/* Type selector */}
                        <Select
                          value={char.display_type}
                          onChange={e => handleChangeType(char, e.target.value as Characteristic['display_type'])}
                          className="text-xs h-7 py-0 w-32"
                        >
                          <option value="select">Select</option>
                          <option value="radio">Radio</option>
                          <option value="swatch">Swatch</option>
                          <option value="toggle">Toggle</option>
                          <option value="number">Number input</option>
                        </Select>

                        {/* Class selector */}
                        {classes.length > 0 && (
                          <Select
                            value={char.class_id ?? ''}
                            onChange={e => handleChangeClass(char, e.target.value)}
                            className="text-xs h-7 py-0 w-36"
                          >
                            <option value="">No class</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </Select>
                        )}

                        {/* Value count badge */}
                        <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                          {(values[char.id] ?? []).length} values
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => setToDelete(char)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Expanded: values editor */}
                      {expanded[char.id] && tenant && (
                        <div className="px-4 pb-4 pt-2 border-t bg-muted/10">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Values
                          </p>
                          <CharacteristicValuesEditor
                            characteristicId={char.id}
                            tenantId={tenant.id}
                            values={values[char.id] ?? []}
                            onChange={updated =>
                              setValues(prev => ({ ...prev, [char.id]: updated }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Confirm delete characteristic */}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Delete characteristic?"
        description={`Delete "${toDelete?.name}"? This will also remove it from any products it's attached to.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteChar}
        loading={deleting}
      />

      {/* Confirm delete class */}
      <ConfirmDialog
        open={!!toDeleteClass}
        onOpenChange={open => !open && setToDeleteClass(null)}
        title="Delete class?"
        description={`Delete class "${toDeleteClass?.name}"? Characteristics in this class will become unclassified.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteClass}
        loading={deletingClass}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
