import { useEffect, useState } from 'react'
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Tag } from 'lucide-react'
import {
  fetchCharacteristics,
  createCharacteristic,
  updateCharacteristic,
  deleteCharacteristic,
  fetchClasses,
  createClass,
  deleteClass,
  fetchAllMemberships,
  addCharacteristicToClass,
  removeCharacteristicFromClass,
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
import { t } from '@/i18n'

// ─── DroppableClass card ─────────────────────────────────────────────────────

interface DroppableClassProps {
  cls: CharacteristicClass
  memberIds: string[]
  characteristics: Characteristic[]
  onRemoveMember: (classId: string, charId: string) => void
  onDeleteClass: (cls: CharacteristicClass) => void
}

function DroppableClass({ cls, memberIds, characteristics, onRemoveMember, onDeleteClass }: DroppableClassProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cls.id })

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-lg border bg-card p-3 transition-all min-h-[80px] flex flex-col gap-2',
        isOver ? 'ring-2 ring-primary border-primary bg-primary/5' : '',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{cls.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            ({memberIds.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
          onClick={() => onDeleteClass(cls)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Member chips */}
      {memberIds.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {isOver ? t('Drop here to add') : t('Drag characteristics here')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {memberIds.map(charId => {
            const char = characteristics.find(c => c.id === charId)
            if (!char) return null
            return (
              <span
                key={charId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium"
              >
                {char.name}
                <button
                  type="button"
                  onClick={() => onRemoveMember(cls.id, charId)}
                  className="hover:text-destructive transition-colors"
                  aria-label={`Remove ${char.name} from ${cls.name}`}
                >
                  ×
                </button>
              </span>
            )
          })}
          {isOver && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-dashed border-primary text-primary">
              {t('+ drop here')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DraggableChar row ────────────────────────────────────────────────────────

interface DraggableCharProps {
  char: Characteristic
  classesForChar: CharacteristicClass[]
  values: CharacteristicValue[]
  expanded: boolean
  onToggleExpand: () => void
  onRename: (name: string) => void
  onChangeType: (type: Characteristic['display_type']) => void
  onDelete: () => void
  tenantId: string
  onValuesChange: (updated: CharacteristicValue[]) => void
}

function DraggableChar({
  char,
  classesForChar,
  values,
  expanded,
  onToggleExpand,
  onRename,
  onChangeType,
  onDelete,
  tenantId,
  onValuesChange,
}: DraggableCharProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: char.id })

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-lg border bg-card overflow-hidden transition-opacity',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      {/* Row */}
      <div className="flex items-center gap-2 px-2 py-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...attributes}
          {...listeners}
          aria-label={t('Drag to assign to class')}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Editable name */}
        <input
          className="flex-1 bg-transparent text-sm font-medium outline-none focus:ring-0 min-w-0"
          defaultValue={char.name}
          onBlur={e => onRename(e.target.value)}
        />

        {/* Type selector */}
        <Select
          value={char.display_type}
          onChange={e => onChangeType(e.target.value as Characteristic['display_type'])}
          className="text-xs h-7 py-0 w-32 shrink-0"
        >
          <option value="select">{t('Select')}</option>
          <option value="radio">{t('Radio')}</option>
          <option value="swatch">{t('Swatch')}</option>
          <option value="toggle">{t('Toggle')}</option>
          <option value="number">{t('Number')}</option>
        </Select>

        {/* Class membership tags */}
        <div className="flex gap-1 flex-wrap max-w-[160px] shrink-0">
          {classesForChar.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">{t('no class')}</span>
          ) : (
            classesForChar.map(cls => (
              <span
                key={cls.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
              >
                {cls.name}
              </span>
            ))
          )}
        </div>

        {/* Value count */}
        <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
          {values.length} {values.length !== 1 ? t('vals') : t('val')}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded: values editor */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/10">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {t('Values')}
          </p>
          <CharacteristicValuesEditor
            characteristicId={char.id}
            tenantId={tenantId}
            values={values}
            onChange={onValuesChange}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LibraryPage() {
  const { tenant } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]             = useState(true)
  const [characteristics, setChars]       = useState<Characteristic[]>([])
  const [classes, setClasses]             = useState<CharacteristicClass[]>([])
  const [memberships, setMemberships]     = useState<Record<string, string[]>>({})
  const [values, setValues]               = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({})
  const [activeCharId, setActiveCharId]   = useState<string | null>(null)

  const [showNewChar, setShowNewChar]     = useState(false)
  const [newName, setNewName]             = useState('')
  const [newType, setNewType]             = useState<Characteristic['display_type']>('select')
  const [creatingChar, setCreatingChar]   = useState(false)

  const [showNewClass, setShowNewClass]   = useState(false)
  const [newClassName, setNewClassName]   = useState('')
  const [creatingClass, setCreatingClass] = useState(false)

  const [toDelete, setToDelete]           = useState<Characteristic | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [toDeleteClass, setToDeleteClass] = useState<CharacteristicClass | null>(null)
  const [deletingClass, setDeletingClass] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [chars, cls, allMemberships] = await Promise.all([
        fetchCharacteristics(),
        fetchClasses(),
        fetchAllMemberships(),
      ])
      setChars(chars)
      setClasses(cls)

      const memberMap: Record<string, string[]> = {}
      for (const m of allMemberships) {
        if (!memberMap[m.class_id]) memberMap[m.class_id] = []
        memberMap[m.class_id].push(m.characteristic_id)
      }
      setMemberships(memberMap)

      const valMap: Record<string, CharacteristicValue[]> = {}
      await Promise.all(chars.map(async c => {
        valMap[c.id] = await fetchValuesForCharacteristic(c.id)
      }))
      setValues(valMap)
    } catch {
      toast({ title: t('Failed to load library'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveCharId(active.id as string)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCharId(null)
    if (!over) return
    const charId  = active.id as string
    const classId = over.id as string
    if (memberships[classId]?.includes(charId)) return
    try {
      await addCharacteristicToClass(classId, charId)
      setMemberships(prev => ({
        ...prev,
        [classId]: [...(prev[classId] ?? []), charId],
      }))
    } catch {
      toast({ title: t('Failed to add characteristic to class'), variant: 'destructive' })
    }
  }

  async function handleRemoveMember(classId: string, charId: string) {
    try {
      await removeCharacteristicFromClass(classId, charId)
      setMemberships(prev => ({
        ...prev,
        [classId]: (prev[classId] ?? []).filter(id => id !== charId),
      }))
    } catch {
      toast({ title: t('Failed to remove characteristic from class'), variant: 'destructive' })
    }
  }

  async function handleCreateChar() {
    if (!newName.trim()) return
    setCreatingChar(true)
    try {
      const created = await createCharacteristic({ name: newName.trim(), display_type: newType })
      setChars(prev => [...prev, created])
      setValues(prev => ({ ...prev, [created.id]: [] }))
      setNewName('')
      setNewType('select')
      setShowNewChar(false)
    } catch {
      toast({ title: t('Failed to create characteristic'), variant: 'destructive' })
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
      toast({ title: t('Failed to rename characteristic'), variant: 'destructive' })
    }
  }

  async function handleChangeType(char: Characteristic, display_type: Characteristic['display_type']) {
    try {
      const updated = await updateCharacteristic(char.id, { display_type })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: t('Failed to update type'), variant: 'destructive' })
    }
  }

  async function handleDeleteChar() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteCharacteristic(toDelete.id)
      setChars(prev => prev.filter(c => c.id !== toDelete.id))
      setMemberships(prev => {
        const next = { ...prev }
        for (const classId of Object.keys(next)) {
          next[classId] = next[classId].filter(id => id !== toDelete.id)
        }
        return next
      })
      setToDelete(null)
    } catch {
      toast({ title: t('Failed to delete characteristic'), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreateClass() {
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const created = await createClass({ name: newClassName.trim() })
      setClasses(prev => [...prev, created])
      setMemberships(prev => ({ ...prev, [created.id]: [] }))
      setNewClassName('')
      setShowNewClass(false)
    } catch {
      toast({ title: t('Failed to create class'), variant: 'destructive' })
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
      setMemberships(prev => {
        const next = { ...prev }
        delete next[toDeleteClass.id]
        return next
      })
      setToDeleteClass(null)
    } catch {
      toast({ title: t('Failed to delete class'), variant: 'destructive' })
    } finally {
      setDeletingClass(false)
    }
  }

  const activeChar = activeCharId ? characteristics.find(c => c.id === activeCharId) : null

  function classesForChar(charId: string): CharacteristicClass[] {
    return classes.filter(cls => memberships[cls.id]?.includes(charId))
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Characteristic Library')}
        description={t('Manage all characteristics and classes. Drag a characteristic onto a class card to assign it.')}
      />

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="p-6 space-y-6 max-w-5xl">

          {/* ── Classes ───────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {t('Classes')}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t('Group characteristics into named sections. Assign classes to products.')}
                  </CardDescription>
                </div>
                {!showNewClass && (
                  <Button size="sm" variant="outline" onClick={() => setShowNewClass(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('New class')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {classes.length === 0 && !showNewClass && (
                <p className="text-sm text-muted-foreground mb-3">{t('No classes yet.')}</p>
              )}

              {classes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                  {classes.map(cls => (
                    <DroppableClass
                      key={cls.id}
                      cls={cls}
                      memberIds={memberships[cls.id] ?? []}
                      characteristics={characteristics}
                      onRemoveMember={handleRemoveMember}
                      onDeleteClass={setToDeleteClass}
                    />
                  ))}
                </div>
              )}

              {showNewClass && (
                <div className="flex gap-2 items-center pt-1">
                  <Input
                    placeholder={t('Class name (e.g. Dimensions, Material)')}
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateClass() }}
                    autoFocus
                    className="flex-1 text-sm"
                  />
                  <Button size="sm" onClick={handleCreateClass} loading={creatingClass} disabled={!newClassName.trim()}>
                    {t('Create')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowNewClass(false); setNewClassName('') }}>
                    {t('Cancel')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Characteristics pool ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t('Characteristics')}</CardTitle>
                  <CardDescription className="mt-1">
                    {t('Manage all characteristics and classes. Drag a characteristic onto a class card to assign it.')}
                  </CardDescription>
                </div>
                {!showNewChar && (
                  <Button size="sm" variant="outline" onClick={() => setShowNewChar(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('New characteristic')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* New characteristic form */}
              {showNewChar && (
                <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                  <p className="text-sm font-medium">{t('New characteristic ')}</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('Name (e.g. Material, Width)')}
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
                      <option value="select">{t('Select')}</option>
                      <option value="radio">{t('Radio')}</option>
                      <option value="swatch">{t('Swatch')}</option>
                      <option value="toggle">{t('Toggle')}</option>
                      <option value="number">{t('Number')}</option>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateChar} loading={creatingChar} disabled={!newName.trim()}>
                      {t('Create')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowNewChar(false); setNewName('') }}>
                      {t('Cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {characteristics.length === 0 && !showNewChar && (
                <p className="text-sm text-muted-foreground">{t('No characteristics yet.')}</p>
              )}

              <div className="space-y-1.5">
                {characteristics.map(char => (
                  <DraggableChar
                    key={char.id}
                    char={char}
                    classesForChar={classesForChar(char.id)}
                    values={values[char.id] ?? []}
                    expanded={!!expanded[char.id]}
                    onToggleExpand={() => toggleExpand(char.id)}
                    onRename={name => handleRenameChar(char, name)}
                    onChangeType={type => handleChangeType(char, type)}
                    onDelete={() => setToDelete(char)}
                    tenantId={tenant?.id ?? ''}
                    onValuesChange={updated => setValues(prev => ({ ...prev, [char.id]: updated }))}
                  />
                ))}
              </div>

            </CardContent>
          </Card>

        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeChar && (
            <div className="rounded-lg border bg-card shadow-lg px-3 py-2.5 flex items-center gap-2 opacity-90 max-w-xs">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{activeChar.name}</span>
              <span className="text-xs text-muted-foreground capitalize ml-1">{activeChar.display_type}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title={t('Delete characteristic?')}
        description={`Delete "${toDelete?.name}"? This removes it from all classes and products.`}
        confirmLabel={t('Delete')}
        onConfirm={handleDeleteChar}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!toDeleteClass}
        onOpenChange={open => !open && setToDeleteClass(null)}
        title={t('Delete class?')}
        description={`Delete class "${toDeleteClass?.name}"? Characteristics in this class will remain in the library, unassigned from this class.`}
        confirmLabel={t('Delete')}
        onConfirm={handleDeleteClass}
        loading={deletingClass}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
