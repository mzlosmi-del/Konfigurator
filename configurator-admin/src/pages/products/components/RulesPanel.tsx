import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { fetchRules, createRule, updateRule, deleteRule } from '@/lib/rules'
import { fetchProductCharacteristicsWithValues } from '@/lib/products'
import type {
  Characteristic, CharacteristicValue, ConfigurationRule,
  NumExpr, RuleComparator, RuleCondition, RuleEffect, RuleEffectKind,
  RulePredicate,
} from '@/types/database'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t, getLang, pickTranslation, type Lang } from '@/i18n'
import {
  COMPARATOR_LABELS, EFFECT_KINDS,
  emptyCondition, emptySelectPredicate, emptyCmpPredicate,
  emptyEffect, describeRule,
} from '@/lib/rulesShape'
import { NumExprInput } from './NumExprInput'

interface Props {
  productId: string
}

type ValuesMap = Record<string, CharacteristicValue[]>

const COMPARATORS: RuleComparator[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq']

const EFFECT_PILL_STYLE: Record<RuleEffectKind, string> = {
  hide_value:          'bg-amber-100 text-amber-700 border-amber-300',
  disable_value:       'bg-orange-100 text-orange-700 border-orange-300',
  set_value_default:   'bg-emerald-100 text-emerald-700 border-emerald-300',
  set_value_locked:    'bg-purple-100 text-purple-700 border-purple-300',
  set_numeric_default: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  set_numeric_locked:  'bg-purple-100 text-purple-700 border-purple-300',
}

export function RulesPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()
  const [lang, setLangState] = useState(getLang())

  useEffect(() => {
    const handler = (e: Event) => setLangState((e as CustomEvent<Lang>).detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  const [loading, setLoading]                 = useState(true)
  const [rules, setRules]                     = useState<ConfigurationRule[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [valuesMap, setValuesMap]             = useState<ValuesMap>({})

  // Edit-buffer for the rule being built. Cleared after save.
  const [draftCondition, setDraftCondition] = useState<RuleCondition>(emptyCondition())
  const [draftEffects,   setDraftEffects]   = useState<RuleEffect[]>([])
  const [saving, setSaving]                 = useState(false)

  // Inline edit of an existing rule — one rule at a time.
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editCondition, setEditCondition] = useState<RuleCondition>(emptyCondition())
  const [editEffects,   setEditEffects]   = useState<RuleEffect[]>([])
  const [savingEdit,    setSavingEdit]    = useState(false)

  const load = useCallback(async () => {
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
  }, [productId, toast])

  useEffect(() => { load() }, [load])

  // Light client-side validation; the rules-engine evaluator tolerates a
  // missing field by simply not firing, but a half-built rule is almost
  // certainly a user mistake. Returns false (and shows a toast) when invalid.
  function validateDraft(condition: RuleCondition, effects: RuleEffect[]): boolean {
    if (condition.predicates.length === 0) {
      toast({ title: t('Add at least one condition'), variant: 'destructive' })
      return false
    }
    if (effects.length === 0) {
      toast({ title: t('Add at least one effect'), variant: 'destructive' })
      return false
    }
    return true
  }

  async function handleAdd() {
    if (!validateDraft(draftCondition, draftEffects)) return
    setSaving(true)
    try {
      const created = await createRule({
        product_id: productId,
        condition:  draftCondition,
        effects:    draftEffects,
      })
      setRules(prev => [...prev, created])
      setDraftCondition(emptyCondition())
      setDraftEffects([])
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
      if (editingId === id) cancelEdit()
    } catch {
      toast({ title: t('Failed to delete rule'), variant: 'destructive' })
    }
  }

  function startEdit(rule: ConfigurationRule) {
    setEditingId(rule.id)
    // Deep-copy so the inline editor never mutates the saved rule in place.
    setEditCondition(structuredClone(rule.condition))
    setEditEffects(structuredClone(rule.effects))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditCondition(emptyCondition())
    setEditEffects([])
  }

  async function handleSaveEdit() {
    if (!editingId) return
    if (!validateDraft(editCondition, editEffects)) return
    setSavingEdit(true)
    try {
      const updated = await updateRule(editingId, {
        condition: editCondition,
        effects:   editEffects,
      })
      setRules(prev => prev.map(r => (r.id === updated.id ? updated : r)))
      cancelEdit()
      toast({ title: t('Rule updated') })
    } catch (e) {
      toast({ title: t('Failed to update rule'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-5">
      {/* ── Existing rules ───────────────────────────────────────────────── */}
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('No rules yet. Add one below.')}</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule =>
            rule.id === editingId ? (
              <div key={rule.id} className="rounded-lg border border-primary/40 p-4 space-y-4 bg-muted/10">
                <p className="text-sm font-medium">{t('Edit rule')}</p>

                <ConditionEditor
                  value={editCondition}
                  onChange={setEditCondition}
                  chars={characteristics}
                  valuesMap={valuesMap}
                  lang={lang}
                />

                <EffectsEditor
                  value={editEffects}
                  onChange={setEditEffects}
                  chars={characteristics}
                  valuesMap={valuesMap}
                  lang={lang}
                />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEdit} disabled={savingEdit}>
                    {t('Cancel')}
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} loading={savingEdit} disabled={savingEdit}>
                    {t('Save changes')}
                  </Button>
                </div>
              </div>
            ) : (
              <div key={rule.id} className="flex items-start gap-2 rounded-lg border bg-muted/20 px-4 py-3">
                <div className="flex-1 min-w-0 space-y-1.5 text-sm">
                  <RuleSummary rule={rule} chars={characteristics} valuesMap={valuesMap} lang={lang} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => startEdit(rule)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          )}
        </div>
      )}

      {/* ── New rule form ────────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4 space-y-4 bg-muted/10">
        <p className="text-sm font-medium">{t('New rule')}</p>

        <ConditionEditor
          value={draftCondition}
          onChange={setDraftCondition}
          chars={characteristics}
          valuesMap={valuesMap}
          lang={lang}
        />

        <EffectsEditor
          value={draftEffects}
          onChange={setDraftEffects}
          chars={characteristics}
          valuesMap={valuesMap}
          lang={lang}
        />

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

// ── Rule list summary ───────────────────────────────────────────────────

function RuleSummary({
  rule, chars, valuesMap, lang,
}: {
  rule:      ConfigurationRule
  chars:     Characteristic[]
  valuesMap: ValuesMap
  lang:      string
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-bold text-primary">{t('IF')}</span>
      <span className="text-xs text-muted-foreground font-mono uppercase">
        {rule.condition.mode === 'all' ? t('ALL') : t('ANY')}
      </span>
      {rule.condition.predicates.map((p, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full text-xs border bg-background">
          {predicateLabel(p, chars, valuesMap, lang)}
        </span>
      ))}
      <span className="text-xs text-muted-foreground mx-0.5">→</span>
      {rule.effects.map((e, i) => (
        <span key={i} className={`px-2 py-0.5 rounded-full text-xs border font-medium ${EFFECT_PILL_STYLE[e.type]}`}>
          {effectLabel(e, chars, valuesMap, lang)}
        </span>
      ))}
      <span className="sr-only">{describeRule(rule, chars, valuesMap, lang)}</span>
    </div>
  )
}

function predicateLabel(
  p:         RulePredicate,
  chars:     Characteristic[],
  valuesMap: ValuesMap,
  lang:      string,
): string {
  if (p.type === 'select_eq' || p.type === 'select_neq') {
    const op = p.type === 'select_eq' ? '=' : '≠'
    return `${charNameOrId(chars, p.char_id, lang)} ${op} ${valueNameOrId(valuesMap, p.char_id, p.value_id, lang)}`
  }
  return `${numExprText(p.left, chars, lang)} ${COMPARATOR_LABELS[p.op]} ${numExprText(p.right, chars, lang)}`
}

function effectLabel(
  e:         RuleEffect,
  chars:     Characteristic[],
  valuesMap: ValuesMap,
  lang:      string,
): string {
  const kindLabel = EFFECT_KINDS.find(k => k.kind === e.type)?.label ?? e.type
  switch (e.type) {
    case 'hide_value':
    case 'disable_value':
      return `${kindLabel}: ${anyValueNameOrId(valuesMap, e.value_id, lang)}`
    case 'set_value_default':
    case 'set_value_locked':
      return `${kindLabel}: ${charNameOrId(chars, e.char_id, lang)} = ${valueNameOrId(valuesMap, e.char_id, e.value_id, lang)}`
    case 'set_numeric_default':
    case 'set_numeric_locked':
      return `${kindLabel}: ${charNameOrId(chars, e.char_id, lang)} = ${numExprText(e.expr, chars, lang)}`
  }
}

function numExprText(expr: NumExpr, chars: Characteristic[], lang: string): string {
  if (expr.type === 'number') return String(expr.value)
  if (expr.type === 'input') return charNameOrId(chars, expr.char_id, lang)
  const opSym = { add: '+', subtract: '−', multiply: '×', divide: '÷' }[expr.op]
  return `(${numExprText(expr.left, chars, lang)} ${opSym} ${numExprText(expr.right, chars, lang)})`
}

function charNameOrId(chars: Characteristic[], id: string, lang: string) {
  const c = chars.find(c => c.id === id)
  return c ? pickTranslation(c.name_i18n as Record<string, string> | null, lang, c.name) : id || '—'
}
function valueNameOrId(map: ValuesMap, charId: string, valueId: string, lang: string) {
  const v = map[charId]?.find(v => v.id === valueId)
  return v ? pickTranslation(v.label_i18n as Record<string, string> | null, lang, v.label) : valueId || '—'
}
function anyValueNameOrId(map: ValuesMap, valueId: string, lang: string) {
  for (const list of Object.values(map)) {
    const v = list.find(v => v.id === valueId)
    if (v) return pickTranslation(v.label_i18n as Record<string, string> | null, lang, v.label)
  }
  return valueId || '—'
}

// ── Condition editor ────────────────────────────────────────────────────

function ConditionEditor({
  value, onChange, chars, valuesMap, lang,
}: {
  value:     RuleCondition
  onChange:  (next: RuleCondition) => void
  chars:     Characteristic[]
  valuesMap: ValuesMap
  lang:      string
}) {
  function setMode(mode: 'all' | 'any') {
    onChange({ ...value, mode })
  }
  function setPredicate(i: number, p: RulePredicate) {
    const next = value.predicates.slice()
    next[i] = p
    onChange({ ...value, predicates: next })
  }
  function removePredicate(i: number) {
    onChange({ ...value, predicates: value.predicates.filter((_, j) => j !== i) })
  }
  function addPredicate(kind: 'select_eq' | 'cmp') {
    onChange({
      ...value,
      predicates: [...value.predicates, kind === 'select_eq' ? emptySelectPredicate() : emptyCmpPredicate()],
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-primary w-16 shrink-0">{t('IF')}</span>
        <div className="inline-flex rounded-md border overflow-hidden text-xs">
          {(['all', 'any'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                'px-2.5 py-1 font-medium transition-colors',
                value.mode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              ].join(' ')}
            >
              {m === 'all' ? t('ALL match (AND)') : t('ANY match (OR)')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 pl-[72px]">
        {value.predicates.map((p, i) => (
          <PredicateRow
            key={i}
            value={p}
            onChange={next => setPredicate(i, next)}
            onRemove={() => removePredicate(i)}
            chars={chars}
            valuesMap={valuesMap}
            lang={lang}
          />
        ))}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => addPredicate('select_eq')}>
            <Plus className="h-3 w-3 mr-1" />
            {t('Value condition')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => addPredicate('cmp')}>
            <Plus className="h-3 w-3 mr-1" />
            {t('Numeric condition')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PredicateRow({
  value, onChange, onRemove, chars, valuesMap, lang,
}: {
  value:     RulePredicate
  onChange:  (next: RulePredicate) => void
  onRemove:  () => void
  chars:     Characteristic[]
  valuesMap: ValuesMap
  lang:      string
}) {
  if (value.type === 'select_eq' || value.type === 'select_neq') {
    const selectChars = chars.filter(c => c.display_type !== 'number')
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={value.char_id}
          onChange={e => onChange({ ...value, char_id: e.target.value, value_id: '' })}
          className="text-xs h-7 w-44"
        >
          <option value="">{t('(characteristic)')}</option>
          {selectChars.map(c => (
            <option key={c.id} value={c.id}>
              {pickTranslation(c.name_i18n as Record<string, string> | null, lang, c.name)}
            </option>
          ))}
        </Select>
        <Select
          value={value.type}
          onChange={e => onChange({ ...value, type: e.target.value as 'select_eq' | 'select_neq' })}
          className="text-xs h-7 w-16"
        >
          <option value="select_eq">=</option>
          <option value="select_neq">≠</option>
        </Select>
        <Select
          value={value.value_id}
          onChange={e => onChange({ ...value, value_id: e.target.value })}
          className="text-xs h-7 w-44"
          disabled={!value.char_id}
        >
          <option value="">{t('(value)')}</option>
          {(valuesMap[value.char_id] ?? []).map(v => (
            <option key={v.id} value={v.id}>
              {pickTranslation(v.label_i18n as Record<string, string> | null, lang, v.label)}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  // numeric comparison
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <NumExprInput value={value.left} onChange={left => onChange({ ...value, left })} chars={chars} lang={lang} />
      <Select
        value={value.op}
        onChange={e => onChange({ ...value, op: e.target.value as RuleComparator })}
        className="text-xs h-7 w-16 font-mono"
      >
        {COMPARATORS.map(op => (
          <option key={op} value={op}>{COMPARATOR_LABELS[op]}</option>
        ))}
      </Select>
      <NumExprInput value={value.right} onChange={right => onChange({ ...value, right })} chars={chars} lang={lang} />
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── Effects editor ───────────────────────────────────────────────────────

function EffectsEditor({
  value, onChange, chars, valuesMap, lang,
}: {
  value:     RuleEffect[]
  onChange:  (next: RuleEffect[]) => void
  chars:     Characteristic[]
  valuesMap: ValuesMap
  lang:      string
}) {
  function setEffect(i: number, e: RuleEffect) {
    const next = value.slice()
    next[i] = e
    onChange(next)
  }
  function removeEffect(i: number) {
    onChange(value.filter((_, j) => j !== i))
  }
  function addEffect() {
    onChange([...value, emptyEffect('hide_value')])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-primary w-16 shrink-0">{t('THEN')}</span>
        <Button variant="outline" size="sm" onClick={addEffect}>
          <Plus className="h-3 w-3 mr-1" />
          {t('Add effect')}
        </Button>
      </div>
      <div className="space-y-1.5 pl-[72px]">
        {value.map((e, i) => (
          <EffectRow
            key={i}
            value={e}
            onChange={next => setEffect(i, next)}
            onRemove={() => removeEffect(i)}
            chars={chars}
            valuesMap={valuesMap}
            lang={lang}
          />
        ))}
      </div>
    </div>
  )
}

function EffectRow({
  value, onChange, onRemove, chars, valuesMap, lang,
}: {
  value:     RuleEffect
  onChange:  (next: RuleEffect) => void
  onRemove:  () => void
  chars:     Characteristic[]
  valuesMap: ValuesMap
  lang:      string
}) {
  const numericChars = chars.filter(c => c.display_type === 'number')
  const selectChars  = chars.filter(c => c.display_type !== 'number')

  function changeKind(kind: RuleEffectKind) {
    onChange(emptyEffect(kind))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={value.type}
        onChange={e => changeKind(e.target.value as RuleEffectKind)}
        className="text-xs h-7 w-44"
      >
        {EFFECT_KINDS.map(k => (
          <option key={k.kind} value={k.kind}>{t(k.label)}</option>
        ))}
      </Select>

      {/* Target characteristic (omitted for hide/disable — those target a value globally) */}
      {(value.type === 'set_value_default' || value.type === 'set_value_locked'
        || value.type === 'set_numeric_default' || value.type === 'set_numeric_locked') && (
        <Select
          value={value.char_id}
          onChange={e => {
            if (value.type === 'set_value_default' || value.type === 'set_value_locked') {
              onChange({ ...value, char_id: e.target.value, value_id: '' })
            } else {
              onChange({ ...value, char_id: e.target.value })
            }
          }}
          className="text-xs h-7 w-44"
        >
          <option value="">{t('(target characteristic)')}</option>
          {((value.type === 'set_numeric_default' || value.type === 'set_numeric_locked') ? numericChars : selectChars)
            .map(c => (
              <option key={c.id} value={c.id}>
                {pickTranslation(c.name_i18n as Record<string, string> | null, lang, c.name)}
              </option>
            ))}
        </Select>
      )}

      {/* Value picker for hide / disable / set_value_default / set_value_locked */}
      {(value.type === 'hide_value' || value.type === 'disable_value') && (
        <Select
          value={value.value_id}
          onChange={e => onChange({ ...value, value_id: e.target.value })}
          className="text-xs h-7 w-56"
        >
          <option value="">{t('(value to hide/disable)')}</option>
          {chars.flatMap(c =>
            (valuesMap[c.id] ?? []).map(v => (
              <option key={v.id} value={v.id}>
                {pickTranslation(c.name_i18n as Record<string, string> | null, lang, c.name)}
                {' · '}
                {pickTranslation(v.label_i18n as Record<string, string> | null, lang, v.label)}
              </option>
            )),
          )}
        </Select>
      )}
      {(value.type === 'set_value_default' || value.type === 'set_value_locked') && (
        <Select
          value={value.value_id}
          onChange={e => onChange({ ...value, value_id: e.target.value })}
          className="text-xs h-7 w-44"
          disabled={!value.char_id}
        >
          <option value="">{t('(value)')}</option>
          {(valuesMap[value.char_id] ?? []).map(v => (
            <option key={v.id} value={v.id}>
              {pickTranslation(v.label_i18n as Record<string, string> | null, lang, v.label)}
            </option>
          ))}
        </Select>
      )}

      {/* Numeric expression for numeric defaults / locks */}
      {(value.type === 'set_numeric_default' || value.type === 'set_numeric_locked') && (
        <NumExprInput
          value={value.expr}
          onChange={expr => onChange({ ...value, expr })}
          chars={chars}
          lang={lang}
        />
      )}

      {/* "Free of charge" toggle — only for set_value_locked. When checked,
          the locked value's price_modifier is overridden to 0 (bundled). */}
      {value.type === 'set_value_locked' && (
        <label
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none"
          title={t('When this rule auto-locks the value, its price modifier is treated as 0 (included with the parent selection).')}
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={!!value.waive_price}
            onChange={e => onChange({ ...value, waive_price: e.target.checked })}
          />
          {t('Free of charge (included)')}
        </label>
      )}

      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
