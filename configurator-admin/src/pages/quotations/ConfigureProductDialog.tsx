import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { CharacteristicWithValues } from '@/lib/products'
import type { ConfigurationRule } from '@/types/database'
import { evaluateRules, sanitizeSelection, applyDefaultValues } from '@/lib/configurationRules'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n'

interface Props {
  open:             boolean
  onOpenChange:     (open: boolean) => void
  productName:      string
  basePrice:        number
  currency:         string
  characteristics:  CharacteristicWithValues[]
  rules:            ConfigurationRule[]
  initialSelection: Record<string, string>
  onApply:          (selection: Record<string, string>) => void
}

export function ConfigureProductDialog({
  open,
  onOpenChange,
  productName,
  basePrice,
  currency,
  characteristics,
  rules,
  initialSelection,
  onApply,
}: Props) {
  const [selection, setSelection] = useState<Record<string, string>>(initialSelection)

  // Reset to initial selection each time the dialog opens
  useEffect(() => {
    if (open) setSelection(initialSelection)
  }, [open])

  const ruleEffect = useMemo(
    () => evaluateRules(rules, selection),
    [rules, selection]
  )

  const configuredPrice = useMemo(() => {
    let price = Number(basePrice)
    for (const char of characteristics) {
      const valueId = selection[char.id]
      if (!valueId) continue
      const val = char.characteristic_values.find(v => v.id === valueId)
      if (!val) continue
      const effective = ruleEffect.priceOverrides[val.id] ?? Number(val.price_modifier)
      price += effective
    }
    return Math.max(0, price)
  }, [basePrice, characteristics, selection, ruleEffect])

  function handleSelect(charId: string, valueId: string) {
    const next     = { ...selection, [charId]: valueId }
    const effect   = evaluateRules(rules, next)
    const withDef  = applyDefaultValues(next, effect, new Set([charId]))
    setSelection(sanitizeSelection(withDef, effect))
  }

  function handleNumericInput(charId: string, raw: string) {
    setSelection(prev => {
      const next = { ...prev, [charId]: raw }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            {t('Configure')} — {productName}
          </DialogTitle>
          <DialogDescription>
            {t('Select options for this product. The price updates automatically.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {characteristics.map(char => {
            const isNumber = char.display_type === 'number'
            const lockedValueId = ruleEffect.lockedValues[char.id]
            const lockedNumeric = ruleEffect.lockedNumericValues[char.id]

            if (isNumber) {
              const isLocked = char.id in ruleEffect.lockedNumericValues
              return (
                <div key={char.id} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {char.name}
                    {isLocked && <span className="ml-1.5 text-xs text-muted-foreground">({t('locked')})</span>}
                  </label>
                  <Input
                    type="number"
                    value={isLocked ? String(lockedNumeric) : (selection[char.id] ?? '')}
                    disabled={isLocked}
                    onChange={e => handleNumericInput(char.id, e.target.value)}
                    className="w-40"
                    placeholder="0"
                  />
                </div>
              )
            }

            const visibleValues = char.characteristic_values
              .filter(v => !ruleEffect.hiddenValues.has(v.id))
              .sort((a, b) => a.sort_order - b.sort_order)

            return (
              <div key={char.id} className="space-y-1.5">
                <label className="text-sm font-medium">{char.name}</label>
                <div className="flex flex-wrap gap-1.5">
                  {visibleValues.map(v => {
                    const isDisabled = ruleEffect.disabledValues.has(v.id)
                    const isLocked   = lockedValueId === v.id
                    const isSelected = selection[char.id] === v.id

                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isDisabled && !isLocked}
                        onClick={() => { if (!isLocked) handleSelect(char.id, v.id) }}
                        className={[
                          'px-3 py-1.5 rounded-md text-sm border transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-input hover:bg-muted',
                          isDisabled && !isLocked ? 'opacity-40 cursor-not-allowed' : '',
                          isLocked ? 'ring-2 ring-primary/30 cursor-default' : 'cursor-pointer',
                        ].filter(Boolean).join(' ')}
                      >
                        {v.label}
                        {v.price_modifier !== 0 && (
                          <span className="ml-1 text-xs opacity-70">
                            ({v.price_modifier > 0 ? '+' : ''}{v.price_modifier.toFixed(2)})
                          </span>
                        )}
                        {isLocked && (
                          <span className="ml-1 text-xs opacity-60">🔒</span>
                        )}
                      </button>
                    )
                  })}
                  {visibleValues.length === 0 && (
                    <span className="text-sm text-muted-foreground">{t('No available options')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Price display */}
        <div className="border-t pt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('Configured unit price')}</span>
          <span className="text-xl font-semibold tabular-nums">
            {configuredPrice.toFixed(2)} <span className="text-base font-normal text-muted-foreground">{currency}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={() => onApply(selection)}>
            {t('Apply configuration')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
