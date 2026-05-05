import { h } from 'preact'
import { useState, useEffect, useMemo, useRef } from 'preact/hooks'
import type { FullProductConfig, Selection, NumericInputs, WidgetConfig, ConfigLineItem } from '../types'
import { loadProductConfig } from '../api'
import { evaluateRules, calculatePrice, buildOptionBreakdown, sanitizeSelection, applyDefaultValues, applyNumericDefaults } from '../rules'
import { calculateFormulaTotal, calculateFormulaBreakdown } from '../formulaEngine'
import { t, getLang, setLang, LANGS, pickTranslation, type Lang } from '../i18n'
import { Visualization } from './Visualization'
import { CharacteristicInput } from './CharacteristicInput'
import { InquiryForm } from './InquiryForm'

interface Props {
  config:       WidgetConfig
  track:        (type: string, payload?: Record<string, unknown>) => void
  onThemeLoad?: (theme: string) => void
}

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: FullProductConfig }
  | { phase: 'success'; data: FullProductConfig }

export function Widget({ config, track, onThemeLoad }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [selection, setSelection] = useState<Selection>({})
  const [numericInputs, setNumericInputs] = useState<NumericInputs>({})
  const [showForm, setShowForm] = useState(false)
  const [lang, setLangState] = useState<Lang>(getLang())
  const prevDefaultsRef        = useRef<Record<string, string>>({})
  const prevNumericDefaultsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const handler = (e: Event) => setLangState((e as CustomEvent<Lang>).detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  useEffect(() => {
    loadProductConfig(config)
      .then(data => {
        setState({ phase: 'ready', data })

        // Apply initial rules (set_value_default / locked)
        const initial: Selection        = {}
        const initialEffect             = evaluateRules(data.rules, initial, {})
        const withDefaults              = applyDefaultValues(initial, initialEffect)
        const sanitized                 = sanitizeSelection(withDefaults, initialEffect)
        const numericDefaults           = applyNumericDefaults({}, initialEffect)
        prevDefaultsRef.current         = initialEffect.defaultValues
        prevNumericDefaultsRef.current  = initialEffect.defaultNumericValues
        setSelection(sanitized)
        setNumericInputs(numericDefaults)
        if (data.product.widget_theme) onThemeLoad?.(data.product.widget_theme)
      })
      .catch(err => {
        setState({ phase: 'error', message: err.message })
      })
  }, [config.productId])

  function handleSelect(charId: string, valueId: string) {
    if (state.phase !== 'ready') return
    track('characteristic_changed', { char_id: charId, value_id: valueId })
    const next      = { ...selection, [charId]: valueId }
    const effect    = evaluateRules(state.data.rules, next, numericInputs)
    const withDef   = applyDefaultValues(next, effect, new Set([charId]), prevDefaultsRef.current)
    const sanitized = sanitizeSelection(withDef, effect)

    // Apply newly-active numeric defaults triggered by this selection change
    const newNumericEntries = Object.entries(effect.defaultNumericValues)
      .filter(([id]) => !(id in prevNumericDefaultsRef.current))
    if (newNumericEntries.length > 0) {
      setNumericInputs(prev => ({ ...prev, ...Object.fromEntries(newNumericEntries) }))
    }

    prevDefaultsRef.current        = effect.defaultValues
    prevNumericDefaultsRef.current = effect.defaultNumericValues
    setSelection(sanitized)
  }

  function handleNumericInput(charId: string, value: number) {
    if (state.phase !== 'ready') return
    const nextNumeric = { ...numericInputs, [charId]: value }
    const effect      = evaluateRules(state.data.rules, selection, nextNumeric)

    // Apply newly-active string defaults triggered by this numeric change
    const withDef   = applyDefaultValues(selection, effect, new Set(), prevDefaultsRef.current)
    const sanitized = sanitizeSelection(withDef, effect)
    if (sanitized !== selection) setSelection(sanitized)

    // Apply newly-active numeric defaults (never override the field the user just typed in)
    const newNumericEntries = Object.entries(effect.defaultNumericValues)
      .filter(([id]) => id !== charId && !(id in prevNumericDefaultsRef.current))
    const finalNumeric = newNumericEntries.length > 0
      ? { ...nextNumeric, ...Object.fromEntries(newNumericEntries) }
      : nextNumeric

    prevDefaultsRef.current        = effect.defaultValues
    prevNumericDefaultsRef.current = effect.defaultNumericValues
    setNumericInputs(finalNumeric)
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const ruleEffect = useMemo(() => {
    if (state.phase !== 'ready') {
      return { hiddenValues: new Set<string>(), disabledValues: new Set<string>(), priceOverrides: {}, defaultValues: {}, lockedValues: {}, defaultNumericValues: {}, lockedNumericValues: {} }
    }
    return evaluateRules(state.data.rules, selection, numericInputs)
  }, [state, selection, numericInputs])

  const totalPrice = useMemo(() => {
    if (state.phase !== 'ready') return 0
    const base        = calculatePrice(state.data.product.base_price, selection, state.data.characteristics, ruleEffect.priceOverrides)
    const formulaAdj  = calculateFormulaTotal(state.data.formulas, {
      base_price:      state.data.product.base_price,
      selection,
      numericInputs,
      characteristics: state.data.characteristics,
    })
    return Math.max(0, base + formulaAdj)
  }, [state, selection, numericInputs, ruleEffect])

  // Per-component breakdown shown above the total price
  const priceBreakdown = useMemo(() => {
    if (state.phase !== 'ready') return null
    const options = buildOptionBreakdown(selection, state.data.characteristics, ruleEffect.priceOverrides)
    const formulas = calculateFormulaBreakdown(state.data.formulas, {
      base_price:      state.data.product.base_price,
      selection,
      numericInputs,
      characteristics: state.data.characteristics,
    })
    return { base: state.data.product.base_price, options, formulas }
  }, [state, selection, numericInputs, ruleEffect])

  const lineItems = useMemo((): ConfigLineItem[] => {
    if (state.phase !== 'ready') return []
    const items: ConfigLineItem[] = []

    for (const char of state.data.characteristics) {
      const charName = pickTranslation(char.name_i18n, lang, char.name)
      if (char.display_type === 'number') {
        const val = numericInputs[char.id]
        if (val !== undefined && val !== 0) {
          items.push({ characteristic_name: charName, value_label: String(val), price_modifier: 0 })
        }
        continue
      }
      if (!selection[char.id]) continue
      const v = char.values.find(val => val.id === selection[char.id])
      if (v) items.push({ characteristic_name: charName, value_label: pickTranslation(v.label_i18n, lang, v.label), price_modifier: v.price_modifier })
    }

    return items
  }, [state, selection, numericInputs, lang])

  const allSelected = useMemo(() => {
    if (state.phase !== 'ready') return false
    return state.data.characteristics.every(c => {
      if (c.display_type === 'number') return numericInputs[c.id] !== undefined
      return !!selection[c.id]
    })
  }, [state, selection, numericInputs])

  // ── Renders ─────────────────────────────────────────────────────────────────

  function LangSwitcher() {
    return (
      <div class="cw-lang-switcher">
        {LANGS.map(l => (
          <button
            key={l}
            type="button"
            class={`cw-lang-btn${lang === l ? ' cw-lang-btn--active' : ''}`}
            onClick={() => { setLang(l); setLangState(l) }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    )
  }

  if (state.phase === 'loading') {
    return (
      <div class="cw-root">
        <div class="cw-loading">
          <div class="cw-spinner" />
          {t('Loading configurator\u2026')}
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div class="cw-root">
        <div class="cw-error">
          ⚠ {state.message}
        </div>
      </div>
    )
  }

  if (state.phase === 'success') {
    return (
      <div class="cw-root">
        <div class="cw-success">
          <div class="cw-success-icon">✓</div>
          <h3>{t('Inquiry sent!')}</h3>
          <p>{state.data.postInquiryMessage ?? t("Thank you. We'll get back to you as soon as possible.")}</p>
        </div>
        {!state.data.removeBranding && (
          <div class="cw-branding">
            <LangSwitcher />
            <a href="https://konfigurator.app" target="_blank" rel="noopener">
              {t('Powered by Konfigurator')}
            </a>
          </div>
        )}
      </div>
    )
  }

  const { product, characteristics, assets, removeBranding } = state.data

  return (
    <div class="cw-root">
      {/* Product image */}
      <Visualization assets={assets} selection={selection} numericInputs={numericInputs} arEnabled={product.ar_enabled} arPlacement={product.ar_placement ?? 'floor'} />

      <div class="cw-body">
        {/* Product info */}
        <div class="cw-product-name">{pickTranslation(product.name_i18n, lang, product.name)}</div>
        {product.description && (
          <div class="cw-product-desc">{pickTranslation(product.description_i18n, lang, product.description)}</div>
        )}

        {/* Characteristics */}
        {characteristics.length > 0 && (
          <div class="cw-characteristics">
            {characteristics.map(char => (
              <CharacteristicInput
                key={char.id}
                characteristic={char}
                selectedValueId={selection[char.id]}
                ruleEffect={ruleEffect}
                numericInputs={numericInputs}
                onChange={handleSelect}
                onNumericInput={handleNumericInput}
                lang={lang}
              />
            ))}
          </div>
        )}

        {/* Pricing breakdown */}
        {priceBreakdown && (() => {
          const rows: Array<{ label: string; amount: number }> = []
          rows.push({ label: t('Base price'), amount: priceBreakdown.base })
          for (const opt of priceBreakdown.options) {
            if (opt.amount === 0) continue
            const char = characteristics.find(c => c.id === opt.char_id)
            if (!char) continue
            const charName = pickTranslation(char.name_i18n, lang, char.name)
            const value = char.values.find(v => v.id === opt.value_id)
            const valueLabel = value ? pickTranslation(value.label_i18n, lang, value.label) : ''
            rows.push({ label: `${charName}: ${valueLabel}`, amount: opt.amount })
          }
          for (const f of priceBreakdown.formulas) {
            if (f.amount === 0) continue
            rows.push({ label: f.name, amount: f.amount })
          }
          // Only render if there's at least one modifier or formula contribution
          if (rows.length <= 1) return null
          return (
            <div class="cw-price-breakdown">
              <div class="cw-breakdown-title">{t('Price breakdown')}</div>
              {rows.map((r, i) => (
                <div class="cw-breakdown-row" key={i}>
                  <span class="cw-breakdown-label">{r.label}</span>
                  <span class={`cw-breakdown-amount${i === 0 ? '' : (r.amount >= 0 ? ' positive' : ' negative')}`}>
                    {i === 0 ? '' : (r.amount >= 0 ? '+' : '')}{r.amount.toFixed(2)} {product.currency}
                  </span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Inquiry form (replaces sticky CTA when shown) */}
        {showForm && (
          <InquiryForm
            config={config}
            productId={product.id}
            tenantId={config.tenantId}
            lineItems={lineItems}
            totalPrice={totalPrice}
            currency={product.currency}
            formConfig={product.form_config}
            onSuccess={() => {
              track('inquiry_submitted', { price: totalPrice, currency: product.currency })
              setState({ phase: 'success', data: state.data })
            }}
          />
        )}
      </div>

      {/* Sticky price bar with selection chips */}
      {!showForm && (
        <div class="cw-bar">
          {lineItems.length > 0 && (
            <div class="cw-bar-chips">
              {lineItems.map((item, i) => (
                <span class="cw-chip" key={i}>
                  <span class="cw-chip-key">{item.characteristic_name}</span>
                  <span class="cw-chip-val">{item.value_label}</span>
                </span>
              ))}
            </div>
          )}
          <div class="cw-bar-row">
            <div class="cw-bar-price">
              <span class="cw-bar-price-label">{t('Total price')}</span>
              <span>
                <span class="cw-bar-price-value">{totalPrice.toFixed(2)}</span>
                <span class="cw-bar-price-currency">{product.currency}</span>
              </span>
            </div>
            <button
              class="cw-bar-cta"
              onClick={() => { track('inquiry_started', { price: totalPrice }); setShowForm(true) }}
              disabled={!allSelected}
            >
              {allSelected ? t('Request a quote') : t('Select all options to continue')}
            </button>
          </div>
        </div>
      )}

      {!removeBranding && (
        <div class="cw-branding">
          <LangSwitcher />
          <a href="https://konfigurator.app" target="_blank" rel="noopener">
            {t('Powered by Konfigurator')}
          </a>
        </div>
      )}
    </div>
  )
}
