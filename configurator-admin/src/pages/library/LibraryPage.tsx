import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import {
  fetchCharacteristics,
  createCharacteristic,
  updateCharacteristic,
  deleteCharacteristicCascade,
  fetchClasses,
  createClass,
  updateClass,
  deleteClass,
  fetchAllMemberships,
  addCharacteristicToClass,
  removeCharacteristicFromClass,
  reorderClassMembers,
  fetchValuesForCharacteristic,
} from '@/lib/products'
import { CharacteristicDeletionDialog } from './CharacteristicDeletionDialog'
import { DraggableChar } from './DraggableChar'
import { LibraryToolbar } from './LibraryToolbar'
import { ClassRail } from './ClassRail'
import { ClassDetailHeader } from './ClassDetailHeader'
import type { LibraryView, TypeFilter } from './types'
import type { Characteristic, CharacteristicClass, CharacteristicValue, NeonConfig } from '@/types/database'
import type { ColorCharOption } from './NeonConfigEditor'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useAuthContext } from '@/components/auth/AuthContext'
import { t } from '@/i18n'
import { computeDiff, logChange } from '@/lib/auditLog'
import { CHARACTERISTIC_LABELS, CLASS_LABELS } from '@/lib/auditLabels'
import { setEntityI18nText } from '@/lib/texts'

// ─── Main page ────────────────────────────────────────────────────────────────

export function LibraryPage() {
  const { tenant, profile } = useAuthContext()
  const userName = profile?.email ?? null
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]             = useState(true)
  const [characteristics, setChars]       = useState<Characteristic[]>([])
  const [classes, setClasses]             = useState<CharacteristicClass[]>([])
  const [memberships, setMemberships]     = useState<Record<string, string[]>>({})
  const [values, setValues]               = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({})
  const [activeCharId, setActiveCharId]   = useState<string | null>(null)

  // Navigation / filter state.
  const [activeView, setActiveView]       = useState<LibraryView>('all')
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState<TypeFilter>('all')

  const [showNewChar, setShowNewChar]     = useState(false)
  const [newName, setNewName]             = useState('')
  const [newType, setNewType]             = useState<Characteristic['display_type']>('select')
  const [creatingChar, setCreatingChar]   = useState(false)

  const [showNewClass, setShowNewClass]   = useState(false)
  const [newClassName, setNewClassName]   = useState('')
  const [newClassI18n, setNewClassI18n]   = useState<Record<string, string>>({})
  const [creatingClass, setCreatingClass] = useState(false)

  const [toDelete, setToDelete]           = useState<Characteristic | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [toDeleteClass, setToDeleteClass] = useState<CharacteristicClass | null>(null)
  const [deletingClass, setDeletingClass] = useState(false)

  // A small activation distance keeps clicks on inline controls from starting
  // a drag (so the name input, selects, and chevrons stay usable).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [chars, cls, allMemberships] = await Promise.all([
        fetchCharacteristics(),
        fetchClasses(),
        fetchAllMemberships(),
      ])
      setChars(chars)
      setClasses(cls)

      // allMemberships is already ordered by sort_order, so each class's
      // member array preserves the intended characteristic order.
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
  }, [toast])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const cls of classes) counts[cls.id] = memberships[cls.id]?.length ?? 0
    return counts
  }, [classes, memberships])

  const assignedIds = useMemo(() => {
    const set = new Set<string>()
    for (const ids of Object.values(memberships)) for (const id of ids) set.add(id)
    return set
  }, [memberships])

  const unassignedCount = useMemo(
    () => characteristics.filter(c => !assignedIds.has(c.id)).length,
    [characteristics, assignedIds],
  )

  function classesForChar(charId: string): CharacteristicClass[] {
    return classes.filter(cls => memberships[cls.id]?.includes(charId))
  }

  const activeClass = activeView !== 'all' && activeView !== 'unassigned'
    ? classes.find(c => c.id === activeView) ?? null
    : null
  const isReorderView = !!activeClass

  // The list shown in the right pane, in the order it should render.
  const visibleChars = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byType = (c: Characteristic) => typeFilter === 'all' || c.display_type === typeFilter
    const byName = (c: Characteristic) => q === '' || c.name.toLowerCase().includes(q)

    let base: Characteristic[]
    if (activeView === 'all') {
      base = characteristics
    } else if (activeView === 'unassigned') {
      base = characteristics.filter(c => !assignedIds.has(c.id))
    } else {
      // Single class: render in the class's stored membership order.
      const order = memberships[activeView] ?? []
      const charById = new Map(characteristics.map(c => [c.id, c]))
      base = order.map(id => charById.get(id)).filter((c): c is Characteristic => !!c)
    }
    return base.filter(c => byType(c) && byName(c))
  }, [activeView, characteristics, assignedIds, memberships, search, typeFilter])

  // ── Drag handling ───────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveCharId(active.id as string)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCharId(null)
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    if (isReorderView && activeClass) {
      // Reorder within the active class. `over` is another characteristic row.
      if (activeId === overId) return
      await reorderActiveClass(activeClass.id, activeId, overId)
      return
    }

    // Assign: `over` is a class id in the rail.
    await handleAssign(overId, activeId)
  }

  async function reorderActiveClass(classId: string, activeId: string, overId: string) {
    const current = memberships[classId] ?? []
    const from = current.indexOf(activeId)
    const to = current.indexOf(overId)
    if (from === -1 || to === -1) return
    const next = arrayMove(current, from, to)
    setMemberships(prev => ({ ...prev, [classId]: next }))
    try {
      await reorderClassMembers(
        classId,
        next.map((characteristic_id, sort_order) => ({ characteristic_id, sort_order })),
      )
    } catch {
      // Roll back to the prior order on failure.
      setMemberships(prev => ({ ...prev, [classId]: current }))
      toast({ title: t('Failed to reorder'), variant: 'destructive' })
    }
  }

  async function handleAssign(classId: string, charId: string) {
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

  // ── Characteristic CRUD ───────────────────────────────────────────────────

  async function handleCreateChar() {
    if (!newName.trim()) return
    setCreatingChar(true)
    try {
      const created = await createCharacteristic({ name: newName.trim(), display_type: newType })
      logChange({ entityType: 'characteristic', entityId: created.id, entityName: created.name, changeType: 'create', changedByName: userName })
      setChars(prev => [...prev, created])
      setValues(prev => ({ ...prev, [created.id]: [] }))
      // If a class is selected, assign the new characteristic to it.
      if (activeClass) await handleAssign(activeClass.id, created.id)
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
      const diff = computeDiff(char as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, CHARACTERISTIC_LABELS)
      logChange({ entityType: 'characteristic', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: t('Failed to rename characteristic'), variant: 'destructive' })
    }
  }

  async function handleUpdateCharI18n(char: Characteristic, i18n: Record<string, string>) {
    if (!tenant?.id) return
    try {
      await setEntityI18nText({
        tenant_id: tenant.id,
        level: 'characteristic',
        reference_id: char.id,
        slot: 'name',
        i18n,
      })
      setChars(prev => prev.map(c => c.id === char.id ? { ...c, name_i18n: i18n } : c))
    } catch {
      toast({ title: t('Failed to save translation'), variant: 'destructive' })
    }
  }

  async function handleUpdateCharDescriptionI18n(char: Characteristic, i18n: Record<string, string>) {
    if (!tenant?.id) return
    try {
      await setEntityI18nText({
        tenant_id: tenant.id,
        level: 'characteristic',
        reference_id: char.id,
        slot: 'description',
        i18n,
      })
      setChars(prev => prev.map(c => c.id === char.id ? { ...c, description_i18n: i18n } : c))
    } catch {
      toast({ title: t('Failed to save description translation'), variant: 'destructive' })
    }
  }

  async function handleChangeType(char: Characteristic, display_type: Characteristic['display_type']) {
    try {
      const updated = await updateCharacteristic(char.id, { display_type })
      const diff = computeDiff(char as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, CHARACTERISTIC_LABELS)
      logChange({ entityType: 'characteristic', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: t('Failed to update type'), variant: 'destructive' })
    }
  }

  async function handleUpdateBounds(char: Characteristic, numeric_min: number | null, numeric_max: number | null) {
    try {
      const updated = await updateCharacteristic(char.id, { numeric_min, numeric_max })
      const diff = computeDiff(char as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, CHARACTERISTIC_LABELS)
      logChange({ entityType: 'characteristic', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: t('Failed to update allowed range'), variant: 'destructive' })
    }
  }

  async function handleUpdatePricing(char: Characteristic, patch: { price_per_char?: number; color_price_modifier?: number }) {
    try {
      const updated = await updateCharacteristic(char.id, patch)
      const diff = computeDiff(char as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, CHARACTERISTIC_LABELS)
      logChange({ entityType: 'characteristic', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: t('Failed to update price'), variant: 'destructive' })
    }
  }

  async function handleUpdateNeonConfig(char: Characteristic, neon_config: NeonConfig | null) {
    try {
      const updated = await updateCharacteristic(char.id, { neon_config })
      const diff = computeDiff(char as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, CHARACTERISTIC_LABELS)
      logChange({ entityType: 'characteristic', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setChars(prev => prev.map(c => c.id === char.id ? updated : c))
    } catch {
      toast({ title: t('Failed to update neon preview'), variant: 'destructive' })
    }
  }

  async function handleDeleteChar() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteCharacteristicCascade(toDelete.id)
      logChange({ entityType: 'characteristic', entityId: toDelete.id, entityName: toDelete.name, changeType: 'delete', changedByName: userName })
      setChars(prev => prev.filter(c => c.id !== toDelete.id))
      setMemberships(prev => {
        const next = { ...prev }
        for (const classId of Object.keys(next)) {
          next[classId] = next[classId].filter(id => id !== toDelete.id)
        }
        return next
      })
      setToDelete(null)
    } catch (e) {
      toast({
        title:       t('Failed to delete characteristic'),
        description: e instanceof Error ? e.message : undefined,
        variant:     'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Class CRUD ──────────────────────────────────────────────────────────────

  async function handleCreateClass() {
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const created = await createClass({ name: newClassName.trim(), name_i18n: newClassI18n })
      logChange({ entityType: 'class', entityId: created.id, entityName: created.name, changeType: 'create', changedByName: userName })
      setClasses(prev => [...prev, created])
      setMemberships(prev => ({ ...prev, [created.id]: [] }))
      setNewClassName('')
      setNewClassI18n({})
      setShowNewClass(false)
    } catch {
      toast({ title: t('Failed to create class'), variant: 'destructive' })
    } finally {
      setCreatingClass(false)
    }
  }

  async function handleRenameClass(id: string, name: string) {
    if (!name.trim()) return
    try {
      const before = classes.find(c => c.id === id)
      const updated = await updateClass(id, { name: name.trim() })
      const diff = computeDiff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, CLASS_LABELS)
      logChange({ entityType: 'class', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setClasses(prev => prev.map(c => c.id === id ? updated : c))
    } catch {
      toast({ title: t('Failed to rename class'), variant: 'destructive' })
    }
  }

  async function handleUpdateClassI18n(id: string, i18n: Record<string, string>) {
    try {
      const updated = await updateClass(id, { name_i18n: i18n })
      setClasses(prev => prev.map(c => c.id === id ? updated : c))
    } catch {
      toast({ title: t('Failed to save translation'), variant: 'destructive' })
    }
  }

  async function handleDeleteClass() {
    if (!toDeleteClass) return
    setDeletingClass(true)
    try {
      await deleteClass(toDeleteClass.id)
      logChange({ entityType: 'class', entityId: toDeleteClass.id, entityName: toDeleteClass.name, changeType: 'delete', changedByName: userName })
      setClasses(prev => prev.filter(c => c.id !== toDeleteClass.id))
      setMemberships(prev => {
        const next = { ...prev }
        delete next[toDeleteClass.id]
        return next
      })
      // If we were viewing the deleted class, fall back to All.
      if (activeView === toDeleteClass.id) setActiveView('all')
      setToDeleteClass(null)
    } catch {
      toast({ title: t('Failed to delete class'), variant: 'destructive' })
    } finally {
      setDeletingClass(false)
    }
  }

  const activeChar = activeCharId ? characteristics.find(c => c.id === activeCharId) : null

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  const rightPaneTitle = activeView === 'all'
    ? t('All characteristics')
    : activeView === 'unassigned'
      ? t('Unassigned')
      : activeClass?.name ?? ''

  // Colour-bearing characteristics that can drive a neon glow. A 'swatch' or
  // other select-style char exposes its values (with hex_color); a free-form
  // 'color' char has no values. The neon editor binds by characteristic id; at
  // runtime the widget resolves it against whatever chars the product loads.
  const neonColorChars: ColorCharOption[] = useMemo(
    () => characteristics
      .filter(c => c.display_type === 'swatch' || c.display_type === 'select' || c.display_type === 'radio' || c.display_type === 'toggle' || c.display_type === 'color')
      .map(c => ({
        id: c.id,
        name: c.name,
        display_type: c.display_type,
        values: (values[c.id] ?? []).map(v => ({ id: v.id, label: v.label, hex_color: v.hex_color })),
      })),
    [characteristics, values],
  )

  const charRows = (
    <div className="space-y-1.5">
      {visibleChars.map(char => (
        <DraggableChar
          key={char.id}
          char={char}
          classesForChar={classesForChar(char.id)}
          allClasses={classes}
          values={values[char.id] ?? []}
          expanded={!!expanded[char.id]}
          sortable={isReorderView}
          unassigned={activeView === 'all' && !assignedIds.has(char.id)}
          onToggleExpand={() => toggleExpand(char.id)}
          onRename={name => handleRenameChar(char, name)}
          onUpdateI18n={i18n => handleUpdateCharI18n(char, i18n)}
          onUpdateDescriptionI18n={i18n => handleUpdateCharDescriptionI18n(char, i18n)}
          onChangeType={type => handleChangeType(char, type)}
          onUpdateBounds={(min, max) => handleUpdateBounds(char, min, max)}
          onUpdatePricing={patch => handleUpdatePricing(char, patch)}
          onUpdateNeonConfig={next => handleUpdateNeonConfig(char, next)}
          neonColorChars={neonColorChars}
          onDelete={() => setToDelete(char)}
          onAssignToClass={classId => handleAssign(classId, char.id)}
          onRemoveFromClass={activeClass ? (classId => handleRemoveMember(classId, char.id)) : undefined}
          tenantId={tenant?.id ?? ''}
          onValuesChange={updated => setValues(prev => ({ ...prev, [char.id]: updated }))}
        />
      ))}
    </div>
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Characteristic Library')}
        description={t('Manage all characteristics and classes. Drag a characteristic onto a class to assign it.')}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <LibraryToolbar
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onNewCharacteristic={() => setShowNewChar(true)}
          onNewClass={() => { setShowNewClass(true); setActiveView('all') }}
        />

        <div className="flex min-h-[60vh]">
          <ClassRail
            classes={classes}
            memberCounts={memberCounts}
            totalCount={characteristics.length}
            unassignedCount={unassignedCount}
            activeView={activeView}
            onSelectView={setActiveView}
            showNewClass={showNewClass}
            newClassName={newClassName}
            newClassI18n={newClassI18n}
            creatingClass={creatingClass}
            onShowNewClass={() => setShowNewClass(true)}
            onNewClassNameChange={setNewClassName}
            onNewClassI18nChange={setNewClassI18n}
            onCreateClass={handleCreateClass}
            onCancelNewClass={() => { setShowNewClass(false); setNewClassName(''); setNewClassI18n({}) }}
          />

          {/* Right pane */}
          <div className="flex-1 p-4 overflow-x-auto">
            {activeClass && (
              <ClassDetailHeader
                cls={activeClass}
                memberCount={memberCounts[activeClass.id] ?? 0}
                onRename={handleRenameClass}
                onUpdateI18n={handleUpdateClassI18n}
                onDelete={setToDeleteClass}
              />
            )}

            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">{rightPaneTitle}</span>
                <span className="text-muted-foreground"> · {visibleChars.length}</span>
              </div>
              {!isReorderView && (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('Drag onto a class in the rail to assign')}
                </span>
              )}
            </div>

            {/* New characteristic form */}
            {showNewChar && (
              <div className="mb-3 rounded-lg border p-4 space-y-3 bg-muted/10">
                <p className="text-sm font-medium">{t('New characteristic')}</p>
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
                    <option value="boolean">{t('Boolean')}</option>
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

            {visibleChars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {search.trim() || typeFilter !== 'all'
                  ? t('No characteristics match your filters.')
                  : t('No characteristics yet.')}
              </p>
            ) : isReorderView ? (
              <SortableContext items={visibleChars.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {charRows}
              </SortableContext>
            ) : (
              charRows
            )}
          </div>
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

      <CharacteristicDeletionDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        characteristicId={toDelete?.id ?? null}
        onConfirm={handleDeleteChar}
        deleting={deleting}
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
