import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { fetchFormulas, createFormula, updateFormula, deleteFormula } from '@/lib/formulas'
import { fetchCharacteristics, fetchValuesForCharacteristic } from '@/lib/products'
import type { PricingFormula, FormulaNode, Characteristic, CharacteristicValue } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { FormulaBuilder } from './FormulaBuilder'
import { t } from '@/i18n'

interface Props {
  productId: string
}

const DEFAULT_FORMULA: FormulaNode = { type: 'number', value: 0 }

export function FormulaPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]               = useState(true)
  const [formulas, setFormulas]             = useState<PricingFormula[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [valuesMap, setValuesMap]           = useState<Record<string, CharacteristicValue[]>>({})
  const [expanded, setExpanded]             = useState<Record<string, boolean>>({})

  const [showNew, setShowNew]               = useState(false)
  const [newName, setNewName]               = useState('')
  const [newFormula, setNewFormula]         = useState<FormulaNode>(DEFAULT_FORMULA)
  const [saving, setSaving]                 = useState(false)

  const [editFormulas, setEditFormulas]     = useState<Record<string, FormulaNode>>({})
  const [editNames, setEditNames]           = useState<Record<string, string>>({})
  const [savingId, setSavingId]             = useState<string | null>(null)

  useEffect(() => { load() }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [formulasData, chars] = await Promise.all([
        fetchFormulas(productId),
        fetchCharacteristics(),
      ])
      setFormulas(formulasData)
      setCharacteristics(chars)

      const entries = await Promise.all(
        chars.map(async c => [c.id, await fetchValuesForCharacteristic(c.id)] as const)
      )
      setValuesMap(Object.fromEntries(entries))
    } catch {
      toast({ title: t('Failed to load formulas'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast({ title: t('Enter a formula name'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const created = await createFormula({ product_id: productId, name: newName.trim(), formula: newFormula })
      setFormulas(prev => [...prev, created])
      setNewName('')
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
      const updated = await updateFormula(id, {
        name:    editNames[id]    ?? formulas.find(f => f.id === id)?.name,
        formula: editFormulas[id] ?? formulas.find(f => f.id === id)?.formula as FormulaNode,
      })
      setFormulas(prev => prev.map(f => f.id === id ? updated : f))
      setEditFormulas(prev => { const n = { ...prev }; delete n[id]; return n })
      setEditNames(prev =>    { const n = { ...prev }; delete n[id]; return n })
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
      setFormulas(prev => prev.map(f => f.id === formula.id ? updated : f))
    } catch {
      toast({ title: t('Failed to update formula'), variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFormula(id)
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

  function currentName(f: PricingFormula): string {
    return editNames[f.id] ?? f.name
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
        const isDirty    = (editFormulas[f.id] !== undefined) || (editNames[f.id] !== undefined)

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
                <Input
                  value={currentName(f)}
                  onChange={e => setEditNames(prev => ({ ...prev, [f.id]: e.target.value }))}
                  placeholder={t('Formula name')}
                  className="max-w-xs text-sm"
                />
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">{t('Formula expression')}</p>
                  <FormulaBuilder
                    node={currentFormula(f)}
                    onChange={node => setEditFormulas(prev => ({ ...prev, [f.id]: node }))}
                    characteristics={characteristics}
                    valuesMap={valuesMap}
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
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t("Formula name (e.g. 'Size surcharge', 'Material discount')")}
            autoFocus
          />
          <div className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">{t('Formula expression')}</p>
            <FormulaBuilder
              node={newFormula}
              onChange={setNewFormula}
              characteristics={characteristics}
              valuesMap={valuesMap}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewName(''); setNewFormula(DEFAULT_FORMULA) }}>
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={handleCreate} loading={saving} disabled={saving || !newName.trim()}>
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
