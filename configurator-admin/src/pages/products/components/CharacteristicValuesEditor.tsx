import { useMemo, useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  createCharacteristicValue,
  updateCharacteristicValue,
  deleteCharacteristicValue,
  fetchValuesForCharacteristic,
} from '@/lib/products'
import { CONTENT_LANGUAGES } from '@/lib/languages'
import type { CharacteristicValue } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

const valueSchema = z.object({
  label: z.string().min(1, 'Label is required').max(300),
  price_modifier: z.coerce.number(),
})
type ValueForm = z.infer<typeof valueSchema>

interface Props {
  characteristicId: string
  tenantId: string
  values: CharacteristicValue[]
  onChange: (values: CharacteristicValue[]) => void
}

export function CharacteristicValuesEditor({
  characteristicId,
  tenantId,
  values,
  onChange,
}: Props) {
  const { toasts, toast, dismiss } = useToast()
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editLang, setEditLang] = useState<string>('primary')

  // Languages that already have at least one translation across all values
  const activeLangs = useMemo(() => {
    const seen = new Set<string>()
    for (const v of values) {
      const i18n = (v.label_i18n as Record<string, string> | null) ?? {}
      for (const k of Object.keys(i18n)) seen.add(k)
    }
    return Array.from(seen).sort()
  }, [values])

  // Extra languages the user manually opened for editing
  const [extraLangs, setExtraLangs] = useState<string[]>([])
  const [addingLang, setAddingLang] = useState(false)
  const [pendingLang, setPendingLang] = useState('')

  const displayLangs = ['primary', ...Array.from(new Set([...activeLangs, ...extraLangs]))]
  const unusedLangs = CONTENT_LANGUAGES.filter(l => !displayLangs.includes(l.code))

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ValueForm>({ resolver: zodResolver(valueSchema), defaultValues: { price_modifier: 0 } })

  function getLabelForLang(value: CharacteristicValue): string {
    if (editLang === 'primary') return value.label
    const i18n = (value.label_i18n as Record<string, string> | null) ?? {}
    return i18n[editLang] ?? ''
  }

  async function handleAdd(data: ValueForm) {
    try {
      const created = await createCharacteristicValue({
        characteristic_id: characteristicId,
        tenant_id: tenantId,
        label: data.label,
        price_modifier: data.price_modifier,
        sort_order: values.length,
      })
      onChange([...values, created])
      reset({ label: '', price_modifier: 0 })
      setAdding(false)
    } catch {
      toast({ title: 'Failed to add value', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteCharacteristicValue(id)
      onChange(values.filter(v => v.id !== id))
    } catch {
      toast({ title: 'Failed to delete value', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleInlineEdit(value: CharacteristicValue, rawValue: string) {
    if (editLang === 'primary') {
      if (rawValue === value.label) return
      try {
        const result = await updateCharacteristicValue(value.id, { label: rawValue })
        onChange(values.map(v => (v.id === value.id ? result : v)))
      } catch {
        const fresh = await fetchValuesForCharacteristic(characteristicId)
        onChange(fresh)
        toast({ title: 'Failed to update value', variant: 'destructive' })
      }
    } else {
      const existing = (value.label_i18n as Record<string, string> | null) ?? {}
      const merged: Record<string, string> = { ...existing }
      if (rawValue.trim()) merged[editLang] = rawValue.trim()
      else delete merged[editLang]
      try {
        const result = await updateCharacteristicValue(value.id, { label_i18n: merged })
        onChange(values.map(v => (v.id === value.id ? result : v)))
      } catch {
        const fresh = await fetchValuesForCharacteristic(characteristicId)
        onChange(fresh)
        toast({ title: 'Failed to update translation', variant: 'destructive' })
      }
    }
  }

  async function handlePriceEdit(value: CharacteristicValue, raw: string) {
    const price_modifier = parseFloat(raw) || 0
    if (price_modifier === value.price_modifier) return
    try {
      const result = await updateCharacteristicValue(value.id, { price_modifier })
      onChange(values.map(v => (v.id === value.id ? result : v)))
    } catch {
      const fresh = await fetchValuesForCharacteristic(characteristicId)
      onChange(fresh)
      toast({ title: 'Failed to update value', variant: 'destructive' })
    }
  }

  function handleAddLang() {
    if (!pendingLang) return
    setExtraLangs(prev => [...prev, pendingLang])
    setEditLang(pendingLang)
    setPendingLang('')
    setAddingLang(false)
  }

  const langLabel = (lang: string) =>
    lang === 'primary' ? 'Default' : lang.toUpperCase()

  return (
    <div className="space-y-2">
      {/* Language tab switcher */}
      <div className="flex flex-wrap items-center gap-1">
        {displayLangs.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => setEditLang(l)}
            className={[
              'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
              editLang === l
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary hover:text-foreground',
            ].join(' ')}
          >
            {langLabel(l)}
          </button>
        ))}

        {/* Add language picker */}
        {addingLang ? (
          <div className="flex items-center gap-1">
            <select
              value={pendingLang}
              onChange={e => setPendingLang(e.target.value)}
              autoFocus
              className="h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Language…</option>
              {unusedLangs.map(l => (
                <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddLang}
              disabled={!pendingLang}
              className="text-xs text-primary disabled:text-muted-foreground hover:underline"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setAddingLang(false); setPendingLang('') }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        ) : unusedLangs.length > 0 && (
          <button
            type="button"
            onClick={() => setAddingLang(true)}
            className="px-1.5 py-0.5 rounded text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
          >
            + language
          </button>
        )}

        {editLang !== 'primary' && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            — editing {CONTENT_LANGUAGES.find(l => l.code === editLang)?.name ?? editLang} labels
          </span>
        )}
      </div>

      {/* Existing values */}
      {values.map(value => (
        <div
          key={value.id}
          className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm group"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

          <input
            key={`${value.id}-${editLang}`}
            className="flex-1 bg-transparent outline-none focus:ring-0 min-w-0"
            defaultValue={getLabelForLang(value)}
            placeholder={editLang !== 'primary' ? value.label : undefined}
            onBlur={e => handleInlineEdit(value, e.target.value)}
          />

          {editLang === 'primary' && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-muted-foreground text-xs">±</span>
              <input
                className="w-16 bg-transparent text-right outline-none focus:ring-0 tabular-nums text-xs"
                type="number"
                step="0.01"
                defaultValue={value.price_modifier}
                onBlur={e => handlePriceEdit(value, e.target.value)}
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
            loading={deletingId === value.id}
            onClick={() => handleDelete(value.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add new value form — only on primary tab */}
      {editLang === 'primary' && (
        adding ? (
          <form onSubmit={handleSubmit(handleAdd)} className="space-y-2 pt-1">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="Value label (e.g. Oak)"
                  className="h-8 text-sm"
                  autoFocus
                  {...register('label')}
                />
                {errors.label && (
                  <p className="text-xs text-destructive">{errors.label.message}</p>
                )}
              </div>
              <div className="w-20 shrink-0 space-y-1">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="±0.00"
                  className="h-8 text-sm text-right"
                  {...register('price_modifier')}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="h-8" loading={isSubmitting}>
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => { setAdding(false); reset() }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Plus className="h-3 w-3" />
            Add value
          </button>
        )
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
