import { h } from 'preact'
import type { Characteristic, CharacteristicValue, NumericInputs } from '../types'
import { isNumericInRange } from '../types'
import type { RuleEffect } from '../rules'
import { t, tSelect, tNumericRange, pickTranslation, type Lang } from '../i18n'

interface Props {
  characteristic: Characteristic
  selectedValueId: string | undefined
  ruleEffect: RuleEffect
  numericInputs: NumericInputs
  onChange: (charId: string, valueId: string) => void
  onNumericInput: (charId: string, value: number) => void
  lang: Lang
}

function formatModifier(mod: number): string {
  if (mod === 0) return ''
  return mod > 0 ? `+${mod.toFixed(0)}` : `${mod.toFixed(0)}`
}

function modifierClass(mod: number): string {
  if (mod === 0) return ''
  return mod > 0 ? 'cw-modifier positive' : 'cw-modifier negative'
}

function visibleValues(char: Characteristic, effect: RuleEffect): CharacteristicValue[] {
  return char.values.filter(v => !effect.hiddenValues.has(v.id))
}

export function CharacteristicInput({
  characteristic,
  selectedValueId,
  ruleEffect,
  numericInputs,
  onChange,
  onNumericInput,
  lang,
}: Props) {
  const { display_type, id } = characteristic
  const isLocked = id in ruleEffect.lockedValues

  const charName = pickTranslation(characteristic.name_i18n, lang, characteristic.name)

  // ── Number input ────────────────────────────────────────────────────────────
  if (display_type === 'number') {
    const isNumericLocked = id in ruleEffect.lockedNumericValues
    const displayValue    = isNumericLocked
      ? ruleEffect.lockedNumericValues[id]
      : (numericInputs[id] ?? '')
    const { numeric_min, numeric_max } = characteristic
    // Out-of-range only matters once the customer has actually entered a value
    // (and the field isn't rule-locked, which is admin-controlled).
    const currentVal = numericInputs[id]
    const outOfRange = !isNumericLocked
      && currentVal !== undefined
      && !isNumericInRange(currentVal, numeric_min, numeric_max)
    return (
      <div>
        <div class="cw-char-label">{charName}</div>
        <input
          type="number"
          class={`cw-number-input${(isLocked || isNumericLocked) ? ' locked' : ''}${outOfRange ? ' error' : ''}`}
          value={displayValue}
          min={numeric_min ?? undefined}
          max={numeric_max ?? undefined}
          disabled={isLocked || isNumericLocked}
          onInput={(e) => {
            const val = parseFloat((e.target as HTMLInputElement).value)
            onNumericInput(id, isNaN(val) ? 0 : val)
          }}
        />
        {(isLocked || isNumericLocked) && <span class="cw-locked-badge">{t('Auto-set')}</span>}
        {outOfRange && (
          <div class="cw-number-error">{tNumericRange(numeric_min, numeric_max)}</div>
        )}
      </div>
    )
  }

  const visible = visibleValues(characteristic, ruleEffect)
  if (visible.length === 0) return null

  // ── Locked: show read-only badge ────────────────────────────────────────────
  if (isLocked) {
    const lockedValueId = ruleEffect.lockedValues[id]
    const lockedValue   = characteristic.values.find(v => v.id === lockedValueId)
    const lockedLabel   = lockedValue
      ? pickTranslation(lockedValue.label_i18n, lang, lockedValue.label)
      : '—'
    // Rule waived the price for this lock → tell the customer it's bundled.
    const isIncluded = ruleEffect.priceOverrides[id] === 0
    return (
      <div>
        <div class="cw-char-label">{charName}</div>
        <div class="cw-locked-value">
          <span class="cw-locked-label">{lockedLabel}</span>
          <span class="cw-locked-badge">{t('Auto-set')}</span>
          {isIncluded && <span class="cw-included-badge">{t('Included')}</span>}
        </div>
      </div>
    )
  }

  // ── Select ──────────────────────────────────────────────────────────────────
  if (display_type === 'select') {
    return (
      <div>
        <div class="cw-char-label">{charName}</div>
        <select
          class="cw-select"
          value={selectedValueId ?? ''}
          onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value
            if (val) onChange(id, val)
          }}
        >
          <option value="">{tSelect(charName)}</option>
          {visible.map(v => (
            <option
              key={v.id}
              value={v.id}
              disabled={ruleEffect.disabledValues.has(v.id)}
            >
              {pickTranslation(v.label_i18n, lang, v.label)}
              {v.price_modifier !== 0 ? ` (${formatModifier(v.price_modifier)})` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // ── Radio ───────────────────────────────────────────────────────────────────
  if (display_type === 'radio') {
    return (
      <div>
        <div class="cw-char-label">{charName}</div>
        <div class="cw-radio-group">
          {visible.map(v => {
            const disabled = ruleEffect.disabledValues.has(v.id)
            const selected = selectedValueId === v.id
            return (
              <button
                key={v.id}
                class={`cw-radio-btn${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                onClick={() => !disabled && onChange(id, v.id)}
                disabled={disabled}
                type="button"
              >
                {pickTranslation(v.label_i18n, lang, v.label)}
                {v.price_modifier !== 0 && (
                  <span class={modifierClass(v.price_modifier)}>
                    {formatModifier(v.price_modifier)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Swatch (tile cards) ─────────────────────────────────────────────────────
  if (display_type === 'swatch') {
    return (
      <div>
        <div class="cw-char-label">{charName}</div>
        <div class="cw-swatch-group">
          {visible.map(v => {
            const disabled = ruleEffect.disabledValues.has(v.id)
            const selected = selectedValueId === v.id
            const label    = pickTranslation(v.label_i18n, lang, v.label)
            const initials = label.slice(0, 2).toUpperCase()
            return (
              <button
                key={v.id}
                class={`cw-swatch${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                onClick={() => !disabled && onChange(id, v.id)}
                title={label}
                type="button"
              >
                {v.hex_color
                  ? <div class="cw-swatch-tile cw-swatch-color" style={`background:${v.hex_color}`} />
                  : <div class="cw-swatch-tile">{initials}</div>
                }
                <div class="cw-swatch-meta">
                  <span class="cw-swatch-label">{label}</span>
                  {v.price_modifier !== 0 && (
                    <span class={`cw-swatch-mod${v.price_modifier > 0 ? ' positive' : ' negative'}`}>
                      {formatModifier(v.price_modifier)}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Toggle ──────────────────────────────────────────────────────────────────
  if (display_type === 'toggle') {
    return (
      <div>
        <div class="cw-char-label">{charName}</div>
        <div class="cw-toggle-group">
          {visible.map(v => {
            const disabled = ruleEffect.disabledValues.has(v.id)
            const selected = selectedValueId === v.id
            return (
              <button
                key={v.id}
                class={`cw-toggle-btn${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                onClick={() => !disabled && onChange(id, v.id)}
                disabled={disabled}
                type="button"
              >
                {pickTranslation(v.label_i18n, lang, v.label)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Boolean (single checkbox) ───────────────────────────────────────────────
  // Uses a single value to represent the "checked" state; the value's label
  // is admin-only — the customer just sees the characteristic name. Leaving
  // the box unchecked is allowed (it submits with no selection for this char).
  if (display_type === 'boolean') {
    const value    = visible[0]
    const disabled = !value || ruleEffect.disabledValues.has(value.id)
    const checked  = !!value && selectedValueId === value.id
    return (
      <div>
        <label class={`cw-checkbox-row${disabled ? ' disabled' : ''}`}>
          <input
            type="checkbox"
            class="cw-checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => {
              if (!value || disabled) return
              onChange(id, (e.target as HTMLInputElement).checked ? value.id : '')
            }}
          />
          <span class="cw-checkbox-label">{charName}</span>
          {value && value.price_modifier !== 0 && (
            <span class={modifierClass(value.price_modifier)}>
              {formatModifier(value.price_modifier)}
            </span>
          )}
        </label>
      </div>
    )
  }

  return null
}
