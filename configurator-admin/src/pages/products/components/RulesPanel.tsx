import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { fetchRules, createRule, deleteRule } from '@/lib/rules'
import { fetchCharacteristics, fetchValuesForCharacteristic } from '@/lib/products'
import type { ConfigurationRule, RuleType, Characteristic, CharacteristicValue } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

interface Props {
  productId: string
}

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  hide_value:        'Hide value',
  disable_value:     'Disable value',
  price_override:    'Override price',
  set_value_default: 'Set default value',
  set_value_locked:  'Lock value',
}

const RULE_TYPES: RuleType[] = [
  'hide_value', 'disable_value', 'price_override', 'set_value_default', 'set_value_locked',
]

type ValuesMap = Record<string, CharacteristicValue[]>

export function RulesPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]             = useState(true)
  const [rules, setRules]                 = useState<ConfigurationRule[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [valuesMap, setValuesMap]         = useState<ValuesMap>({})

  // New-rule form state
  const [condCharId, setCondCharId]       = useState('')
  const [condValueId, setCondValueId]     = useState('')
  const [ruleType, setRuleType]           = useState<RuleType>('hide_value')
  const [effCharId, setEffCharId]         = useState('')
  const [effValueId, setEffValueId]       = useState('')
  const [effPrice, setEffPrice]           = useState('0')
  const [saving, setSaving]               = useState(false)

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

      // Load all values in parallel
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

  // When condition char changes, reset condition value
  function handleCondCharChange(id: string) {
    setCondCharId(id)
    setCondValueId('')
  }

  // When effect char changes, reset effect value
  function handleEffCharChange(id: string) {
    setEffCharId(id)
    setEffValueId('')
  }

  // Effect fields depend on rule type
  function effectIsValueBased(t: RuleType) {
    return t === 'hide_value' || t === 'disable_value' || t === 'set_value_default' || t === 'set_value_locked'
  }

  async function handleAdd() {
    if (!condCharId || !condValueId) {
      toast({ title: 'Select a condition characteristic and value', variant: 'destructive' })
      return
    }
    if (effectIsValueBased(ruleType) && (!effCharId || !effValueId)) {
      toast({ title: 'Select a target characteristic and value', variant: 'destructive' })
      return
    }
    if (ruleType === 'price_override' && !effCharId) {
      toast({ title: 'Select a target characteristic for the price override', variant: 'destructive' })
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
      // Reset form
      setCondCharId(''); setCondValueId(''); setEffCharId(''); setEffValueId(''); setEffPrice('0')
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

  const condValues  = valuesMap[condCharId] ?? []
  const effValues   = valuesMap[effCharId]  ?? []

  return (
    <div className="space-y-5">
      {/* Existing rules */}
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No rules yet. Add one below.</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="flex items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm"
            >
              <div className="flex-1 space-y-0.5">
                <span className="text-muted-foreground">IF </span>
                <span className="font-medium">{charName(rule.condition.characteristic_id)}</span>
                <span className="text-muted-foreground"> = </span>
                <span className="font-medium">{valueName(rule.condition.characteristic_id, rule.condition.value_id)}</span>
                <span className="text-muted-foreground"> → </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                  {RULE_TYPE_LABELS[rule.rule_type]}
                </span>
                {rule.effect.characteristic_id && (
                  <>
                    <span className="text-muted-foreground"> on </span>
                    <span className="font-medium">{charName(rule.effect.characteristic_id)}</span>
                  </>
                )}
                {rule.effect.value_id && (
                  <>
                    <span className="text-muted-foreground"> = </span>
                    <span className="font-medium">{valueName(rule.effect.characteristic_id ?? '', rule.effect.value_id)}</span>
                  </>
                )}
                {rule.rule_type === 'price_override' && rule.effect.price_modifier !== undefined && (
                  <span className="font-medium">
                    {rule.effect.price_modifier >= 0 ? ' +' : ' '}{rule.effect.price_modifier}
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
          ))}
        </div>
      )}

      {/* Add rule form */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
        <p className="text-sm font-medium">New rule</p>

        {/* Condition row */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">When</p>
          <div className="flex gap-2">
            <Select
              value={condCharId}
              onChange={e => handleCondCharChange(e.target.value)}
              className="flex-1"
            >
              <option value="">Select characteristic…</option>
              {characteristics.filter(c => c.display_type !== 'number').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <span className="flex items-center text-sm text-muted-foreground px-1">=</span>
            <Select
              value={condValueId}
              onChange={e => setCondValueId(e.target.value)}
              className="flex-1"
              disabled={!condCharId}
            >
              <option value="">Select value…</option>
              {condValues.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Action */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Then</p>
          <Select
            value={ruleType}
            onChange={e => { setRuleType(e.target.value as RuleType); setEffCharId(''); setEffValueId('') }}
          >
            {RULE_TYPES.map(t => (
              <option key={t} value={t}>{RULE_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>

        {/* Effect target */}
        <div className="flex gap-2">
          <Select
            value={effCharId}
            onChange={e => handleEffCharChange(e.target.value)}
            className="flex-1"
          >
            <option value="">Target characteristic…</option>
            {characteristics
              .filter(c => ruleType === 'price_override' ? c.display_type !== 'number' : c.display_type !== 'number')
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </Select>

          {effectIsValueBased(ruleType) && (
            <>
              <span className="flex items-center text-sm text-muted-foreground px-1">=</span>
              <Select
                value={effValueId}
                onChange={e => setEffValueId(e.target.value)}
                className="flex-1"
                disabled={!effCharId}
              >
                <option value="">Target value…</option>
                {effValues.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </Select>
            </>
          )}

          {ruleType === 'price_override' && (
            <input
              type="number"
              value={effPrice}
              onChange={e => setEffPrice(e.target.value)}
              className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Amount"
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} loading={saving} disabled={saving}>
            <Plus className="h-4 w-4" />
            Add rule
          </Button>
        </div>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
