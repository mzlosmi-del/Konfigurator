import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { fetchRules, createRule, deleteRule } from '@/lib/rules'
import { fetchProductCharacteristicsWithValues } from '@/lib/products'
import type { ConfigurationRule, RuleType, Characteristic, CharacteristicValue } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

interface Props {
  productId: string
}

type ValuesMap = Record<string, CharacteristicValue[]>
type NumericOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

const NUMERIC_OPS: { op: NumericOp; label: string }[] = [
  { op: 'gt',  label: '>'  },
  { op: 'gte', label: '≥'  },
  { op: 'lt',  label: '<'  },
  { op: 'lte', label: '≤'  },
  { op: 'eq',  label: '='  },
]

const RULE_TYPE_CONFIG: Partial<Record<RuleType, { label: string; active: string }>> = {
  hide_value:        { label: 'Hide value',     active: 'bg-amber-100 text-amber-700 border-amber-300' },
  disable_value:     { label: 'Disable value',  active: 'bg-orange-100 text-orange-700 border-orange-300' },
  set_value_default: { label: 'Set default',    active: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  set_value_locked:  { label: 'Lock value',     active: 'bg-purple-100 text-purple-700 border-purple-300' },
}

const RULE_TYPES: RuleType[] = [
  'hide_value', 'disable_value', 'set_value_default', 'set_value_locked',
]

function requiresSelectTarget(ruleType: RuleType) {
  return ruleType === 'hide_value' || ruleType === 'disable_value'
}

// ── Pill pickers ──────────────────────────────────────────────────────────────

function CharPicker({ value, chars, onChange }: {
  value: string
  chars: Characteristic[]
  onChange: (id: string) => void
}) {
  if (chars.length === 0) {
    return <span className="text-xs text-muted-foreground italic">{t('No characteristics available')}</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chars.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={[
            'px-2 py-0.5 rounded-full text-xs border font-medium transition-colors',
            value === c.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-input hover:bg-muted',
          ].join(' ')}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

function ValuePicker({ charId, value, valuesMap, onChange }: {
  charId: string
  value: string
  valuesMap: ValuesMap
  onChange: (id: string) => void
}) {
  const vals = valuesMap[charId] ?? []
  if (vals.length === 0) {
    return <span className="text-xs text-muted-foreground italic">{t('No values')}</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {vals.map(v => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          className={[
            'px-2 py-0.5 rounded-full text-xs border transition-colors',
            value === v.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-input hover:bg-muted',
          ].join(' ')}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNumeric(charId: string, chars: Characteristic[]) {
  return chars.find(c => c.id === charId)?.display_type === 'number'
}

// ── Main component ────────────────────────────────────────────────────────────

export function RulesPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]               = useState(true)
  const [rules, setRules]                   = useState<ConfigurationRule[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [valuesMap, setValuesMap]           = useState<ValuesMap>({})

  // Condition
  const [condCharId, setCondCharId]         = useState('')
  const [condValueId, setCondValueId]       = useState('')
  const [condNumericOp, setCondNumericOp]   = useState<NumericOp>('gt')
  const [condNumericVal, setCondNumericVal] = useState('0')

  // Action
  const [ruleType, setRuleType]             = useState<RuleType>('hide_value')

  // Effect target
  const [effCharId, setEffCharId]           = useState('')
  const [effValueId, setEffValueId]         = useState('')
  const [effNumericVal, setEffNumericVal]   = useState('0')

  const [saving, setSaving]                 = useState(false)

  useEffect(() => { load() }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [rulesData, charsWithValues] = await Promise.all([
        fetchRules(productId),
        fetchProductCharacteristicsWithValues(productId),
      ])
      setRules(rulesData)
      const chars: Characteristic[] = charsWithValues.map(c => {
        const { characteristic_values: _cv, ...rest } = c
        return rest as Characteristic
      })
      setCharacteristics(chars)
      const vmap: ValuesMap = {}
      for (const c of charsWithValues) vmap[c.id] = c.characteristic_values
      setValuesMap(vmap)
    } catch {
      toast({ title: t('Failed to load rules'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function handleCondCharChange(id: string) {
    setCondCharId(id)
    setCondValueId('')
  }

  function handleEffCharChange(id: string) {
    setEffCharId(id)
    setEffValueId('')
  }

  async function handleAdd() {
    if (!condCharId) {
      toast({ title: t('Select a condition characteristic'), variant: 'destructive' })
      return
    }
    const condIsNumeric = isNumeric(condCharId, characteristics)
    if (!condIsNumeric && !condValueId) {
      toast({ title: t('Select a condition value'), variant: 'destructive' })
      return
    }
    if (!effCharId) {
      toast({ title: t('Select a target characteristic'), variant: 'destructive' })
      return
    }
    const effIsNumeric = isNumeric(effCharId, characteristics)
    if (!effIsNumeric && !effValueId) {
      toast({ title: t('Select a target value'), variant: 'destructive' })
      return
    }

    const condition: ConfigurationRule['condition'] = condIsNumeric
      ? { characteristic_id: condCharId, numeric_op: condNumericOp, numeric_value: parseFloat(condNumericVal) || 0 }
      : { characteristic_id: condCharId, value_id: condValueId }

    const effect: ConfigurationRule['effect'] = effIsNumeric
      ? { characteristic_id: effCharId, numeric_value: parseFloat(effNumericVal) || 0 }
      : { characteristic_id: effCharId, value_id: effValueId }

    setSaving(true)
    try {
      const created = await createRule({
        product_id: productId,
        rule_type: ruleType,
        condition,
        effect,
      })
      setRules(prev => [...prev, created])
      setCondCharId(''); setCondValueId(''); setCondNumericVal('0')
      setEffCharId(''); setEffValueId(''); setEffNumericVal('0')
      toast({ title: t('Rule added') })
    } catch (e) {
      toast({ title: t('Failed to add rule'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch {
      toast({ title: t('Failed to delete rule'), variant: 'destructive' })
    }
  }

  function charName(id: string) {
    return characteristics.find(c => c.id === id)?.name ?? id
  }

  function valueName(charId: string, valueId: string) {
    return valuesMap[charId]?.find(v => v.id === valueId)?.label ?? valueId
  }

  function ruleConditionLabel(rule: ConfigurationRule) {
    const cond = rule.condition
    if (cond.numeric_op !== undefined) {
      const opLabel = NUMERIC_OPS.find(o => o.op === cond.numeric_op)?.label ?? cond.numeric_op
      return (
        <>
          <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-medium">{charName(cond.characteristic_id)}</span>
          <span className="text-xs text-muted-foreground font-mono">{opLabel}</span>
          <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-mono">{cond.numeric_value}</span>
        </>
      )
    }
    return (
      <>
        <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-medium">{charName(cond.characteristic_id)}</span>
        <span className="text-xs text-muted-foreground">=</span>
        <span className="px-2 py-0.5 rounded-full text-xs border bg-background">{valueName(cond.characteristic_id, cond.value_id ?? '')}</span>
      </>
    )
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  const condIsNumeric = isNumeric(condCharId, characteristics)
  const effectChars = requiresSelectTarget(ruleType)
    ? characteristics.filter(c => c.display_type !== 'number')
    : characteristics
  const effIsNumeric = isNumeric(effCharId, characteristics)

  return (
    <div className="space-y-5">

      {/* ── Existing rules ─────────────────────────────────────────────────── */}
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('No rules yet. Add one below.')}</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const cfg = RULE_TYPE_CONFIG[rule.rule_type]
            if (!cfg) return null
            return (
              <div key={rule.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3">
                <div className="flex-1 flex items-center gap-1.5 flex-wrap text-sm">
                  <span className="text-xs font-bold text-primary">{t('IF')}</span>
                  {ruleConditionLabel(rule)}
                  <span className="text-xs text-muted-foreground mx-0.5">→</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.active}`}>
                    {t(cfg.label)}
                  </span>
                  {rule.effect.characteristic_id && (
                    <>
                      <span className="text-xs text-muted-foreground">{t('on')}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-medium">
                        {charName(rule.effect.characteristic_id)}
                      </span>
                    </>
                  )}
                  {rule.effect.value_id && (
                    <>
                      <span className="text-xs text-muted-foreground">=</span>
                      <span className="px-2 py-0.5 rounded-full text-xs border bg-background">
                        {valueName(rule.effect.characteristic_id ?? '', rule.effect.value_id)}
                      </span>
                    </>
                  )}
                  {rule.effect.numeric_value !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-mono">
                      = {rule.effect.numeric_value}
                    </span>
                  )}

                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── New rule form ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4 space-y-4 bg-muted/10">
        <p className="text-sm font-medium">{t('New rule')}</p>

        {/* Step 1: Condition */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-primary pt-1 w-10 shrink-0">{t('IF')}</span>
            <CharPicker value={condCharId} chars={characteristics} onChange={handleCondCharChange} />
          </div>

          {/* Select-type condition: value picker */}
          {condCharId && !condIsNumeric && (
            <div className="flex items-start gap-3 pl-[52px]">
              <span className="text-xs text-muted-foreground pt-1">=</span>
              <ValuePicker
                charId={condCharId}
                value={condValueId}
                valuesMap={valuesMap}
                onChange={setCondValueId}
              />
            </div>
          )}

          {/* Numeric condition: op pills + number input */}
          {condCharId && condIsNumeric && (
            <div className="flex items-center gap-2 pl-[52px] flex-wrap">
              {NUMERIC_OPS.map(({ op, label }) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setCondNumericOp(op)}
                  className={[
                    'px-2.5 py-0.5 rounded-full text-xs border font-mono font-medium transition-colors',
                    condNumericOp === op
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-muted',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
              <input
                type="number"
                value={condNumericVal}
                onChange={e => setCondNumericVal(e.target.value)}
                className="w-24 rounded border border-input bg-background px-2 py-0.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={t('value')}
              />
            </div>
          )}
        </div>

        {/* Step 2: Action */}
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold text-primary pt-1 w-10 shrink-0">{t('THEN')}</span>
          <div className="flex flex-wrap gap-1.5">
            {RULE_TYPES.map(rt => {
              const cfg = RULE_TYPE_CONFIG[rt]!
              const selected = ruleType === rt
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => { setRuleType(rt); setEffCharId(''); setEffValueId('') }}
                  className={[
                    'px-2.5 py-1 rounded-full text-xs border font-medium transition-colors',
                    selected ? cfg.active : 'bg-background border-input hover:bg-muted',
                  ].join(' ')}
                >
                  {t(cfg.label)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 3: Target characteristic */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-primary pt-1 w-10 shrink-0">{t('ON')}</span>
            <CharPicker value={effCharId} chars={effectChars} onChange={handleEffCharChange} />
          </div>

          {/* Select-type target: value picker */}
          {effCharId && !effIsNumeric && (
            <div className="flex items-start gap-3 pl-[52px]">
              <span className="text-xs text-muted-foreground pt-1">=</span>
              <ValuePicker
                charId={effCharId}
                value={effValueId}
                valuesMap={valuesMap}
                onChange={setEffValueId}
              />
            </div>
          )}

          {/* Numeric target: number input (for set default / lock) */}
          {effCharId && effIsNumeric && (ruleType === 'set_value_default' || ruleType === 'set_value_locked') && (
            <div className="flex items-center gap-2 pl-[52px]">
              <span className="text-xs text-muted-foreground">=</span>
              <input
                type="number"
                value={effNumericVal}
                onChange={e => setEffNumericVal(e.target.value)}
                className="w-28 rounded border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={t('value')}
              />
            </div>
          )}


        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} loading={saving} disabled={saving}>
            {t('Add rule')}
          </Button>
        </div>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
