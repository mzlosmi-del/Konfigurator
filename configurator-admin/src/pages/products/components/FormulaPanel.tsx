import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { fetchFormulas, createFormula, updateFormula, deleteFormula } from '@/lib/formulas'
import { fetchProductCharacteristicsWithValues } from '@/lib/products'
import { setEntityI18nText } from '@/lib/texts'
import type { PricingFormula, FormulaNode, Characteristic, CharacteristicValue } from '@/types/database'
import { Button } from '@/components/ui/button'
import { I18nEditor } from '@/components/ui/i18n-editor'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { FormulaBuilder } from './FormulaBuilder'
import { t } from '@/i18n'
import { logChange } from '@/lib/auditLog'
import { useAuthContext } from '@/components/auth/AuthContext'

/** Pick the canonical plain-name for the `pricing_formulas.name` column from a
 *  translation map: prefer EN, else the first non-empty value. */
function canonicalName(i18n: Record<string, string>): string {
  if (i18n.en?.trim()) return i18n.en.trim()
  const first = Object.values(i18n).find(v => v.trim())
  return (first ?? '').trim()
}

interface Props {
  productId: string
}

const DEFAULT_FORMULA: FormulaNode = { type: 'number', value: 0 }

export function FormulaPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()
  const { profile, tenant } = useAuthContext()
  const userName = profile?.email ?? null

  const [loading, setLoading]               = useState(true)
  const [formulas, setFormulas]             = useState<PricingFormula[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [valuesMap, setValuesMap]           = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded]             = useState<Record<string, boolean>>({})

  const [showNew, setShowNew]               = useState(false)
  const [newNameI18n, setNewNameI18n]       = useState<Record<string, string>>({})
  const [newFormula, setNewFormula]         = useState<FormulaNode>(DEFAULT_FORMULA)
  const [saving, setSaving]                 = useState(false)

  const [editFormulas, setEditFormulas]     = useState<Record<string, FormulaNode>>({})
  const [editNamesI18n, setEditNamesI18n]   = useState<Record<string, Record<string, string>>>({})
  const [savingId, setSavingId]             = useState<string | null>(null)

  useEffect(() => { load() }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [formulasData, charsWithValues] = await Promise.all([
        fetchFormulas(productId),
        fetchProductCharacteristicsWithValues(productId),
      ])
      setFormulas(formulasData)
      setCharacteristics(charsWithValues)
      setValuesMap(Object.fromEntries(charsWithValues.map(c => [c.id, c.characteristic_values])))
    } catch {
      toast({ title: t('Failed to load formulas'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    const canonical = canonicalName(newNameI18n)
    if (!canonical) {
      toast({ title: t('Enter a formula name'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const created = await createFormula({ product_id: productId, name: canonical, formula: newFormula })
      if (tenant) {
        await setEntityI18nText({
          tenant_id: tenant.id, level: 'pricing_formula', reference_id: created.id, slot: 'name', i18n: newNameI18n,
        })
      }
      logChange({ entityType: 'pricing_formula', entityId: created.id, entityName: created.name, changeType: 'create', changedByName: userName })
      setFormulas(prev => [...prev, { ...created, name_i18n: newNameI18n }])
      setNewNameI18n({})
      setNewFormula(DEFAULT_FORMULA)
      setShowNew(false)
      toast({ title: t('Formula created') })
    } catch (e) {
      toast({ title: t('Failed to create formula'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(id: string) {
    setSavingId(id)
    try {
      const before  = formulas.find(f => f.id === id)
      const stagedI18n = editNamesI18n[id]
      const nextI18n   = stagedI18n ?? before?.name_i18n ?? {}
      const nextName   = stagedI18n ? canonicalName(stagedI18n) : (before?.name ?? '')
      if (stagedI18n && !nextName) {
        toast({ title: t('Enter a formula name'), variant: 'destructive' })
        setSavingId(null)
        return
      }
      const updated = await updateFormula(id, {
        name:    nextName,
        formula: editFormulas[id] ?? before?.formula as FormulaNode,
      })
      if (stagedI18n && tenant) {
        await setEntityI18nText({
          tenant_id: tenant.id, level: 'pricing_formula', reference_id: id, slot: 'name', i18n: stagedI18n,
        })
      }
      const diff: Record<string, { old: unknown; new: unknown }> = {}
      if (before) {
        if (before.name !== updated.name) diff[t('Name')] = { old: before.name, new: updated.name }
        if (JSON.stringify(before.formula) !== JSON.stringify(updated.formula))
          diff[t('Formula')] = { old: before.formula, new: updated.formula }
      }
      logChange({ entityType: 'pricing_formula', entityId: updated.id, entityName: updated.name, changeType: 'update', diff, changedByName: userName })
      setFormulas(prev => prev.map(f => f.id === id ? { ...updated, name_i18n: nextI18n } : f))
      setEditFormulas(prev => { const n = { ...prev }; delete n[id]; return n })
      setEditNamesI18n(prev => { const n = { ...prev }; delete n[id]; return n })
      toast({ title: t('Formula saved') })
    } catch (e) {
      toast({ title: t('Failed to save formula'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleActive(formula: PricingFormula) {
    try {
      const updated = await updateFormula(formula.id, { is_active: !formula.is_active })
      logChange({
        entityType: 'pricing_formula',
        entityId:   updated.id,
        entityName: updated.name,
        changeType: 'update',
        diff:       { [t('Active')]: { old: formula.is_active, new: updated.is_active } },
        changedByName: userName,
      })
      setFormulas(prev => prev.map(f => f.id === formula.id ? updated : f))
    } catch {
      toast({ title: t('Failed to update formula'), variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    try {
      const before = formulas.find(f => f.id === id)
      await deleteFormula(id)
      logChange({ entityType: 'pricing_formula', entityId: id, entityName: before?.name ?? null, changeType: 'delete', changedByName: userName })
      setFormulas(prev => prev.filter(f => f.id !== id))
    } catch {
      toast({ title: t('Failed to delete formula'), variant: 'destructive' })
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function currentFormula(f: PricingFormula): FormulaNode {
    return (editFormulas[f.id] ?? f.formula) as FormulaNode
  }

  function currentNameI18n(f: PricingFormula): Record<string, string> {
    return editNamesI18n[f.id] ?? f.name_i18n ?? (f.name ? { en: f.name } : {})
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      {formulas.length === 0 && !showNew && (
        <p className="text-sm text-muted-foreground py-2">{t('No formulas yet. Add one below.')}</p>
      )}

      {formulas.map(f => {
        const isExpanded = !!expanded[f.id]
        const isDirty    = (editFormulas[f.id] !== undefined) || (editNamesI18n[f.id] !== undefined)

        return (
          <div key={f.id} className="rounded-lg border overflow-hidden">
            {/* Header row */}
            <div
              className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors bg-card"
              onClick={() => toggleExpand(f.id)}
            >
              {isExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="font-medium text-sm flex-1">{f.name}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleToggleActive(f) }}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${
                  f.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                }`}
              >
                {f.is_active
                  ? <><ToggleRight className="h-3 w-3" /> {t('Active')}</>
                  : <><ToggleLeft className="h-3 w-3" /> {t('Inactive')}</>}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={e => { e.stopPropagation(); handleDelete(f.id) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="px-4 py-4 border-t bg-muted/5 space-y-4">
                <div className="max-w-sm">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">{t('Formula name')}</p>
                  <I18nEditor
                    value={currentNameI18n(f)}
                    onChange={next => setEditNamesI18n(prev => ({ ...prev, [f.id]: next }))}
                    placeholder={t('Formula name')}
                  />
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">{t('Formula expression')}</p>
                  <FormulaBuilder
                    node={currentFormula(f)}
                    onChange={node => setEditFormulas(prev => ({ ...prev, [f.id]: node }))}
                    characteristics={characteristics}
                    valuesMap={valuesMap}
                    otherFormulas={formulas.filter(other => other.id !== f.id)}
                    isRoot
                  />
                </div>
                {isDirty && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSave(f.id)}
                      loading={savingId === f.id}
                      disabled={savingId === f.id}
                    >
                      {t('Save formula')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* New formula form */}
      {showNew ? (
        <div className="rounded-lg border p-4 space-y-4 bg-muted/10">
          <p className="text-sm font-medium">{t('New formula')}</p>
          <div className="max-w-sm">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">{t('Formula name')}</p>
            <I18nEditor
              value={newNameI18n}
              onChange={setNewNameI18n}
              placeholder={t("Formula name (e.g. 'Size surcharge', 'Material discount')")}
            />
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">{t('Formula expression')}</p>
            <FormulaBuilder
              node={newFormula}
              onChange={setNewFormula}
              characteristics={characteristics}
              valuesMap={valuesMap}
              otherFormulas={formulas}
              isRoot
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewNameI18n({}); setNewFormula(DEFAULT_FORMULA) }}>
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={handleCreate} loading={saving} disabled={saving || !canonicalName(newNameI18n)}>
              {t('Create formula')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('Add formula')}
        </button>
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
