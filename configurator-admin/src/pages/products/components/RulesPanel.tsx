import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { fetchRules, createRule, deleteRule } from '@/lib/rules'
import { fetchCharacteristics, fetchValuesForCharacteristic } from '@/lib/products'
import type { ConfigurationRule, RuleType, Characteristic, CharacteristicValue } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

interface Props {
  productId: string
}

type ValuesMap = Record<string, CharacteristicValue[]>

const RULE_TYPE_CONFIG: Record<RuleType, { label: string; active: string }> = {
  hide_value:        { label: 'Hide value',    active: 'bg-amber-100 text-amber-700 border-amber-300' },
  disable_value:     { label: 'Disable value', active: 'bg-orange-100 text-orange-700 border-orange-300' },
  price_override:    { label: 'Override price', active: 'bg-blue-100 text-blue-700 border-blue-300' },
  set_value_default: { label: 'Set default',   active: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  set_value_locked:  { label: 'Lock value',    active: 'bg-purple-100 text-purple-700 border-purple-300' },
}

const RULE_TYPES: RuleType[] = [
  'hide_value', 'disable_value', 'price_override', 'set_value_default', 'set_value_locked',
]

function effectIsValueBased(t: RuleType) {
  return t !== 'price_override'
}

// ── Pill pickers ──────────────────────────────────────────────────────────────

function CharPicker({ value, chars, onChange }: {
  value: string
  chars: Characteristic[]
  onChange: (id: string) => void
}) {
  if (chars.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No characteristics available</span>
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
    return <span className="text-xs text-muted-foreground italic">No values</span>
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

// ── Main component ────────────────────────────────────────────────────────────

export function RulesPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]               = useState(true)
  const [rules, setRules]                   = useState<ConfigurationRule[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [valuesMap, setValuesMap]           = useState<ValuesMap>({})

  const [condCharId, setCondCharId]         = useState('')
  const [condValueId, setCondValueId]       = useState('')
  const [ruleType, setRuleType]             = useState<RuleType>('hide_value')
  const [effCharId, setEffCharId]           = useState('')
  const [effValueId, setEffValueId]         = useState('')
  const [effPrice, setEffPrice]             = useState('0')
  const [saving, setSaving]                 = useState(false)

  useEffect(() => { load() }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [rulesData, chars] = await Promise.all([
        fetchRules(productId),
        fetchCharacteristics(),
      ])
      setRules(rulesData)
      setCharacteristics(chars)
      const entries = await Promise.all(
        chars.map(async c => [c.id, await fetchValuesForCharacteristic(c.id)] as const)
      )
      setValuesMap(Object.fromEntries(entries))
    } catch {
      toast({ title: 'Failed to load rules', variant: 'destructive' })
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
    if (!condCharId || !condValueId) {
      toast({ title: 'Select a condition characteristic and value', variant: 'destructive' })
      return
    }
    if (!effCharId) {
      toast({ title: 'Select a target characteristic', variant: 'destructive' })
      return
    }
    if (effectIsValueBased(ruleType) && !effValueId) {
      toast({ title: 'Select a target value', variant: 'destructive' })
      return
    }

    const effect: ConfigurationRule['effect'] = effectIsValueBased(ruleType)
      ? { characteristic_id: effCharId, value_id: effValueId }
      : { characteristic_id: effCharId, price_modifier: parseFloat(effPrice) || 0 }

    setSaving(true)
    try {
      const created = await createRule({
        product_id: productId,
        rule_type: ruleType,
        condition: { characteristic_id: condCharId, value_id: condValueId },
        effect,
      })
      setRules(prev => [...prev, created])
      setCondCharId(''); setCondValueId('')
      setEffCharId(''); setEffValueId(''); setEffPrice('0')
      toast({ title: 'Rule added' })
    } catch (e) {
      toast({ title: 'Failed to add rule', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch {
      toast({ title: 'Failed to delete rule', variant: 'destructive' })
    }
  }

  function charName(id: string) {
    return characteristics.find(c => c.id === id)?.name ?? id
  }

  function valueName(charId: string, valueId: string) {
    return valuesMap[charId]?.find(v => v.id === valueId)?.label ?? valueId
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  const selectChars = characteristics.filter(c => c.display_type !== 'number')

  return (
    <div className="space-y-5">

      {/* ── Existing rules ─────────────────────────────────────────────────── */}
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No rules yet. Add one below.</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const cfg = RULE_TYPE_CONFIG[rule.rule_type]
            return (
              <div
                key={rule.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3"
              >
                <div className="flex-1 flex items-center gap-1.5 flex-wrap text-sm">
                  <span className="text-xs font-bold text-primary">IF</span>
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-medium">
                    {charName(rule.condition.characteristic_id)}
                  </span>
                  <span className="text-xs text-muted-foreground">=</span>
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-background">
                    {valueName(rule.condition.characteristic_id, rule.condition.value_id)}
                  </span>
                  <span className="text-xs text-muted-foreground mx-0.5">→</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.active}`}>
                    {cfg.label}
                  </span>
                  {rule.effect.characteristic_id && (
                    <>
                      <span className="text-xs text-muted-foreground">on</span>
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
                  {rule.rule_type === 'price_override' && rule.effect.price_modifier !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-background font-mono">
                      {rule.effect.price_modifier >= 0 ? '+' : ''}{rule.effect.price_modifier}
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
        <p className="text-sm font-medium">New rule</p>

        {/* Step 1: Condition */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-primary pt-1 w-10 shrink-0">IF</span>
            <CharPicker value={condCharId} chars={selectChars} onChange={handleCondCharChange} />
          </div>
          {condCharId && (
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
        </div>

        {/* Step 2: Action */}
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold text-primary pt-1 w-10 shrink-0">THEN</span>
          <div className="flex flex-wrap gap-1.5">
            {RULE_TYPES.map(t => {
              const cfg = RULE_TYPE_CONFIG[t]
              const selected = ruleType === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setRuleType(t); setEffCharId(''); setEffValueId('') }}
                  className={[
                    'px-2.5 py-1 rounded-full text-xs border font-medium transition-colors',
                    selected ? cfg.active : 'bg-background border-input hover:bg-muted',
                  ].join(' ')}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 3: Target characteristic */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-primary pt-1 w-10 shrink-0">ON</span>
            <CharPicker value={effCharId} chars={selectChars} onChange={handleEffCharChange} />
          </div>

          {/* Value picker (value-based rules) */}
          {effCharId && effectIsValueBased(ruleType) && (
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

          {/* Price amount (price_override) */}
          {effCharId && ruleType === 'price_override' && (
            <div className="flex items-center gap-2 pl-[52px]">
              <span className="text-xs text-muted-foreground">amount</span>
              <input
                type="number"
                value={effPrice}
                onChange={e => setEffPrice(e.target.value)}
                className="w-28 rounded border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. 50 or −20"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} loading={saving} disabled={saving}>
            Add rule
          </Button>
        </div>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
