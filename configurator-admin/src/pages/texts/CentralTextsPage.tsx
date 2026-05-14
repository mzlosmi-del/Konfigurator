import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Trash2, Save } from 'lucide-react'
import {
  fetchTexts, upsertText, deleteText,
} from '@/lib/texts'
import { fetchProducts, fetchCharacteristics, fetchValuesForCharacteristic } from '@/lib/products'
import type {
  TenantText, TextLevel, Product, Characteristic, CharacteristicValue,
} from '@/types/database'
import { TEXT_SLOTS, MULTI_ROW_SLOTS } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { useAuthContext } from '@/components/auth/AuthContext'
import { useCanEdit } from '@/hooks/usePermission'
import { t, getLang } from '@/i18n'
import { slotLabel, slotDescription, slotLabelAnyLevel } from '@/lib/textSlots'

const LEVELS: { value: TextLevel; label: string }[] = [
  { value: 'tenant',               label: 'Tenant'               },
  { value: 'product',              label: 'Product'              },
  { value: 'characteristic',       label: 'Characteristic'       },
  { value: 'characteristic_value', label: 'Characteristic value' },
]

const LEVEL_BADGE: Record<TextLevel, string> = {
  tenant:               'bg-amber-100 text-amber-800',
  product:              'bg-blue-100 text-blue-700',
  characteristic:       'bg-violet-100 text-violet-700',
  characteristic_value: 'bg-emerald-100 text-emerald-700',
}

const LANG_BADGE: Record<string, string> = {
  en: 'bg-gray-100 text-gray-700',
  sr: 'bg-sky-100 text-sky-700',
}

/** A row of the BRF+-style table. We keep the in-progress content separate
 *  from the persisted row so editing one row doesn't churn the whole list. */
interface EditState {
  id:        string
  content:   string
  label:     string | null
  dirty:     boolean
  saving:    boolean
}

export function CentralTextsPage() {
  const { tenant } = useAuthContext()
  const canEdit = useCanEdit('texts')
  const { toasts, toast, dismiss } = useToast()

  // Resolve the active UI language once per render — slot labels and
  // tooltips switch with the global language toggle.
  const uiLang = getLang()

  const [loading,    setLoading]    = useState(true)
  const [rows,       setRows]       = useState<TenantText[]>([])
  const [edits,      setEdits]      = useState<Record<string, EditState>>({})

  // Reference lookups for the "Reference" column. We keep a flat map of id → label.
  const [products,        setProducts]        = useState<Product[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [values,          setValues]          = useState<Record<string, CharacteristicValue[]>>({})

  // Filters
  const [filterLevel,    setFilterLevel]    = useState<'' | TextLevel>('')
  const [filterLanguage, setFilterLanguage] = useState<'' | 'en' | 'sr'>('')
  const [filterSlot,     setFilterSlot]     = useState<string>('')
  const [search,         setSearch]         = useState('')

  // Add modal
  const [addOpen, setAddOpen] = useState(false)

  // Delete confirmation
  const [toDelete, setToDelete] = useState<TenantText | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [textRows, prods, chars] = await Promise.all([
        fetchTexts(),
        fetchProducts(),
        fetchCharacteristics(),
      ])
      setRows(textRows)
      setProducts(prods)
      setCharacteristics(chars)
      // Pre-load values for any characteristic that the texts reference.
      const valueIds = textRows
        .filter(r => r.level === 'characteristic_value' && r.reference_id)
        .map(r => r.reference_id!) as string[]
      if (valueIds.length > 0) {
        const charIds = new Set(chars.map(c => c.id))
        const valMap: Record<string, CharacteristicValue[]> = {}
        await Promise.all(Array.from(charIds).map(async id => {
          valMap[id] = await fetchValuesForCharacteristic(id)
        }))
        setValues(valMap)
      }
    } catch (err) {
      toast({ title: t('Failed to load texts'), description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const valueById = useMemo(() => {
    const m: Record<string, CharacteristicValue> = {}
    for (const list of Object.values(values)) for (const v of list) m[v.id] = v
    return m
  }, [values])
  const productById        = useMemo(() => Object.fromEntries(products.map(p        => [p.id, p])), [products])
  const characteristicById = useMemo(() => Object.fromEntries(characteristics.map(c => [c.id, c])), [characteristics])

  function referenceLabel(row: TenantText): string {
    switch (row.level) {
      case 'tenant':               return '—'
      case 'product':              return productById[row.reference_id ?? '']?.name ?? row.reference_id ?? '?'
      case 'characteristic':       return characteristicById[row.reference_id ?? '']?.name ?? row.reference_id ?? '?'
      case 'characteristic_value': {
        const v = valueById[row.reference_id ?? '']
        if (!v) return row.reference_id ?? '?'
        // Prefix with the parent characteristic name so e.g. an "Oak" value
        // reads as "Material — Oak" — essential when several characteristics
        // share short value labels.
        const charName = characteristicById[v.characteristic_id]?.name
        return charName ? `${charName} — ${v.label}` : v.label
      }
    }
  }

  const slotOptions = useMemo(() => {
    const all = new Set<string>()
    for (const list of Object.values(TEXT_SLOTS)) for (const slot of list) all.add(slot)
    for (const r of rows) all.add(r.slot)
    return Array.from(all).sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filterLevel    && r.level    !== filterLevel)    return false
      if (filterLanguage && r.language !== filterLanguage) return false
      if (filterSlot     && r.slot     !== filterSlot)     return false
      if (q) {
        const hay = `${r.content} ${r.label ?? ''} ${r.slot} ${referenceLabel(r)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filterLevel, filterLanguage, filterSlot, search, productById, characteristicById, valueById])

  function patchEdit(id: string, patch: Partial<EditState>) {
    setEdits(prev => {
      const base = prev[id] ?? {
        id,
        content: rows.find(r => r.id === id)?.content ?? '',
        label:   rows.find(r => r.id === id)?.label   ?? null,
        dirty:   false,
        saving:  false,
      }
      return { ...prev, [id]: { ...base, ...patch } }
    })
  }

  async function saveRow(row: TenantText) {
    if (!tenant?.id) return
    const e = edits[row.id]
    if (!e || !e.dirty) return
    patchEdit(row.id, { saving: true })
    try {
      const updated = await upsertText({
        tenant_id:    tenant.id,
        level:        row.level,
        reference_id: row.reference_id,
        slot:         row.slot,
        language:     row.language,
        sort_order:   row.sort_order,
        label:        e.label,
        content:      e.content,
      })
      setRows(prev => prev.map(r => r.id === row.id ? updated : r))
      setEdits(prev => { const { [row.id]: _, ...rest } = prev; return rest })
      toast({ title: t('Saved') })
    } catch (err) {
      toast({ title: t('Failed to save text'), description: String(err), variant: 'destructive' })
      patchEdit(row.id, { saving: false })
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteText(toDelete.id)
      setRows(prev => prev.filter(r => r.id !== toDelete.id))
      setToDelete(null)
      toast({ title: t('Text deleted') })
    } catch (err) {
      toast({ title: t('Failed to delete text'), description: String(err), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Central Texts')}
        description={t('Maintain every piece of customer-facing copy in one place — keyed by level, reference, slot and language. Edit inline; changes save when you click the save icon or blur the textarea.')}
        action={canEdit ? (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t('Add text')}
          </Button>
        ) : undefined}
      />

      <div className="p-6 space-y-4">
        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Level')}</label>
                <Select value={filterLevel} onChange={e => setFilterLevel(e.target.value as '' | TextLevel)}>
                  <option value="">{t('All levels')}</option>
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Slot')}</label>
                <Select value={filterSlot} onChange={e => setFilterSlot(e.target.value)}>
                  <option value="">{t('All slots')}</option>
                  {slotOptions.map(s => (
                    <option key={s} value={s}>
                      {slotLabelAnyLevel(s, uiLang)}{slotLabelAnyLevel(s, uiLang) !== s ? ` (${s})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Language')}</label>
                <Select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value as '' | 'en' | 'sr')}>
                  <option value="">{t('Both')}</option>
                  <option value="en">EN</option>
                  <option value="sr">SR</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Search')}</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('Search content, label, reference…')}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('Showing')} <strong>{filtered.length}</strong> {t('of')} <strong>{rows.length}</strong> {t('rows')}
            </p>
          </CardContent>
        </Card>

        {/* ── The table ───────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-28">{t('Level')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-48">{t('Reference')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-32">{t('Slot')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-14">{t('Lang')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-12">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-40">{t('Label')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">{t('Content')}</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {rows.length === 0
                        ? t('No texts yet. Run the migration 077 backfill, or click "Add text" to create the first row.')
                        : t('No rows match the current filters.')}
                    </td>
                  </tr>
                )}
                {filtered.map(row => {
                  const e        = edits[row.id]
                  const isDirty  = !!e?.dirty
                  const isSaving = !!e?.saving
                  const hasLabel = MULTI_ROW_SLOTS.has(row.slot) && row.level !== 'tenant'
                  return (
                    <tr key={row.id} className={`border-b last:border-0 ${isDirty ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-3 py-2 align-top">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${LEVEL_BADGE[row.level]}`}>
                          {t(LEVELS.find(l => l.value === row.level)?.label ?? row.level)}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-foreground/90">
                        {referenceLabel(row)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className="text-sm cursor-help"
                          title={slotDescription(row.level, row.slot, uiLang) || undefined}
                        >
                          {slotLabel(row.level, row.slot, uiLang)}
                        </span>
                        <span
                          className="ml-1.5 font-mono text-[10px] text-muted-foreground/60 select-all"
                          title={row.slot}
                        >
                          {row.slot}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${LANG_BADGE[row.language]}`}>
                          {row.language.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground tabular-nums">
                        {MULTI_ROW_SLOTS.has(row.slot) ? row.sort_order : '—'}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {hasLabel ? (
                          <Input
                            value={e?.label ?? row.label ?? ''}
                            onChange={ev => patchEdit(row.id, { label: ev.target.value, dirty: true })}
                            onBlur={() => saveRow(row)}
                            disabled={!canEdit || isSaving}
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Textarea
                          value={e?.content ?? row.content}
                          onChange={ev => patchEdit(row.id, { content: ev.target.value, dirty: true })}
                          onBlur={() => saveRow(row)}
                          disabled={!canEdit || isSaving}
                          rows={Math.max(1, Math.min(6, (e?.content ?? row.content).split('\n').length))}
                          className="text-sm min-h-0 resize-y"
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <div className="flex justify-end gap-1">
                          {isDirty && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              onClick={() => saveRow(row)}
                              disabled={isSaving}
                              title={t('Save')}
                              aria-label={t('Save')}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setToDelete(row)}
                              title={t('Delete')}
                              aria-label={t('Delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <AddTextDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenant?.id ?? null}
        products={products}
        characteristics={characteristics}
        valueById={valueById}
        onCreated={created => {
          setRows(prev => [...prev, created])
          setAddOpen(false)
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title={t('Delete text?')}
        description={t('This text will be removed. If a renderer depends on it, the legacy column fallback will be used until you restore it.')}
        confirmLabel={t('Delete')}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── Add-text modal ─────────────────────────────────────────────────────────

interface AddTextDialogProps {
  open:         boolean
  onOpenChange: (o: boolean) => void
  tenantId:     string | null
  products:     Product[]
  characteristics: Characteristic[]
  valueById:    Record<string, CharacteristicValue>
  onCreated:    (row: TenantText) => void
}

function AddTextDialog({ open, onOpenChange, tenantId, products, characteristics, valueById, onCreated }: AddTextDialogProps) {
  const { toast } = useToast()
  const [level,       setLevel]       = useState<TextLevel>('tenant')
  const [referenceId, setReferenceId] = useState<string>('')
  const [slot,        setSlot]        = useState<string>('pdf_footer')
  const [language,    setLanguage]    = useState<'en' | 'sr'>('en')
  const [sortOrder,   setSortOrder]   = useState<number>(0)
  const [label,       setLabel]       = useState<string>('')
  const [content,     setContent]     = useState<string>('')
  const [saving,      setSaving]      = useState(false)

  function reset() {
    setLevel('tenant'); setReferenceId(''); setSlot('pdf_footer')
    setLanguage('en'); setSortOrder(0); setLabel(''); setContent('')
  }

  // Re-anchor slot when level changes, so the slot dropdown stays valid.
  useEffect(() => {
    const slotsForLevel = TEXT_SLOTS[level] as readonly string[]
    if (!slotsForLevel.includes(slot)) setSlot(slotsForLevel[0])
    if (level === 'tenant') setReferenceId('')
  }, [level]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!tenantId) return
    if (level !== 'tenant' && !referenceId) {
      toast({ title: t('Please pick a reference'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const created = await upsertText({
        tenant_id:    tenantId,
        level,
        reference_id: level === 'tenant' ? null : referenceId,
        slot,
        language,
        sort_order:   MULTI_ROW_SLOTS.has(slot) ? sortOrder : 0,
        label:        label.trim() ? label.trim() : null,
        content,
      })
      onCreated(created)
      reset()
    } catch (err) {
      toast({ title: t('Failed to create text'), description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // When picking a characteristic value, prefix each option with the parent
  // characteristic name so e.g. "Oak" reads as "Material — Oak". Without it
  // it's impossible to tell short labels apart when several characteristics
  // share them. Sort by parent characteristic, then by value label.
  const charNameById: Record<string, string> = Object.fromEntries(
    characteristics.map(c => [c.id, c.name]),
  )
  const valueOptions = Object.values(valueById)
    .map(v => {
      const charName = charNameById[v.characteristic_id]
      return {
        id:    v.id,
        label: charName ? `${charName} — ${v.label}` : v.label,
        sortKey: `${charName ?? '~'}|${v.label}`,
      }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ id, label }) => ({ id, label }))

  const referenceOptions: { id: string; label: string }[] =
    level === 'product'              ? products.map(p => ({ id: p.id, label: p.name }))
    : level === 'characteristic'     ? characteristics.map(c => ({ id: c.id, label: c.name }))
    : level === 'characteristic_value' ? valueOptions
    : []

  const slotsForLevel = TEXT_SLOTS[level] as readonly string[]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Add text')}</DialogTitle>
          <DialogDescription>
            {t('Pick a level, reference (if applicable), slot and language. The combination must be unique unless the slot is multi-row.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Level')}</label>
              <Select value={level} onChange={e => setLevel(e.target.value as TextLevel)}>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Language')}</label>
              <Select value={language} onChange={e => setLanguage(e.target.value as 'en' | 'sr')}>
                <option value="en">EN — English</option>
                <option value="sr">SR — Serbian</option>
              </Select>
            </div>
          </div>

          {level !== 'tenant' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Reference')}</label>
              <Select value={referenceId} onChange={e => setReferenceId(e.target.value)}>
                <option value="">{t('— pick one —')}</option>
                {referenceOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Slot')}</label>
              <Select value={slot} onChange={e => setSlot(e.target.value)}>
                {slotsForLevel.map(s => (
                  <option key={s} value={s} title={slotDescription(level, s, getLang())}>
                    {slotLabel(level, s, getLang())}
                  </option>
                ))}
              </Select>
            </div>
            {MULTI_ROW_SLOTS.has(slot) && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Sort order')}</label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={e => setSortOrder(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Live description of the picked slot — saves the user from hunting
              for what the slot actually does. */}
          {slotDescription(level, slot, getLang()) && (
            <p className="text-xs text-muted-foreground leading-relaxed -mt-1">
              {slotDescription(level, slot, getLang())}
            </p>
          )}

          {MULTI_ROW_SLOTS.has(slot) && level !== 'tenant' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Label')}</label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={t('Optional — shown as the block heading on the PDF')}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Content')}</label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder={t('Type the text…')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!content.trim()}>
            {t('Create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
