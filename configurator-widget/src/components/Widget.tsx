import { h } from 'preact'
import { useState, useEffect, useMemo } from 'preact/hooks'
import type { FullProductConfig, Selection, NumericInputs, WidgetConfig, ConfigLineItem } from '../types'
import { loadProductConfig } from '../api'
import { evaluateRules, calculatePrice, sanitizeSelection, applyDefaultValues, applyNumericDefaults } from '../rules'
import { calculateFormulaTotal } from '../formulaEngine'
import { t, getLang, setLang, LANGS, type Lang } from '../i18n'
import { Visualization } from './Visualization'
import { CharacteristicInput } from './CharacteristicInput'
import { InquiryForm } from './InquiryForm'

interface Props {
  config: WidgetConfig
}

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: FullProductConfig }
  | { phase: 'success' }

export function Widget({ config }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [selection, setSelection] = useState<Selection>({})
  const [numericInputs, setNumericInputs] = useState<NumericInputs>({})
  const [userSelections, setUserSelections] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [lang, setLangState] = useState<Lang>(getLang())

  useEffect(() => {
    const handler = (e: Event) => setLangState((e as CustomEvent<Lang>).detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  useEffect(() => {
    loadProductConfig(config)
      .then(data => {
        setState({ phase: 'ready', data })

        // Pre-select first value of each select/radio/swatch/toggle characteristic
        const initial: Selection = {}
        for (const char of data.characteristics) {
          if (char.display_type !== 'number' && char.values.length > 0) {
            initial[char.id] = char.values[0].id
          }
        }

        // Apply initial rules (set_value_default / locked)
        const initialEffect      = evaluateRules(data.rules, initial, {})
        const withDefaults       = applyDefaultValues(initial, initialEffect)
        const sanitized          = sanitizeSelection(withDefaults, initialEffect)
        const numericDefaults    = applyNumericDefaults({}, initialEffect)
        setSelection(sanitized)
        setNumericInputs(numericDefaults)
      })
      .catch(err => {
        setState({ phase: 'error', message: err.message })
      })
  }, [config.productId])

  function handleSelect(charId: string, valueId: string) {
    if (state.phase !== 'ready') return

    const nextUserSel = new Set([...userSelections, charId])
    setUserSelections(nextUserSel)

    const next      = { ...selection, [charId]: valueId }
    const effect    = evaluateRules(state.data.rules, next)
    const withDef   = applyDefaultValues(next, effect, nextUserSel)
    const sanitized = sanitizeSelection(withDef, effect)
    setSelection(sanitized)
  }

  function handleNumericInput(charId: string, value: number) {
    setNumericInputs(prev => ({ ...prev, [charId]: value }))
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

  const lineItems = useMemo((): ConfigLineItem[] => {
    if (state.phase !== 'ready') return []
    const items: ConfigLineItem[] = []

    for (const char of state.data.characteristics) {
      if (char.display_type === 'number') {
        const val = numericInputs[char.id]
        if (val !== undefined && val !== 0) {
          items.push({ characteristic_name: char.name, value_label: String(val), price_modifier: 0 })
        }
        continue
      }
      if (!selection[char.id]) continue
      const v = char.values.find(val => val.id === selection[char.id])
      if (v) items.push({ characteristic_name: char.name, value_label: v.label, price_modifier: v.price_modifier })
    }

    return items
  }, [state, selection, numericInputs])

  const allSelected = useMemo(() => {
    if (state.phase !== 'ready') return false
    return state.data.characteristics.every(c =>
      c.display_type === 'number' || !!selection[c.id]
    )
  }, [state, selection])

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
      <div class="cw-root" key={lang}>
        <div class="cw-loading">
          <div class="cw-spinner" />
          {t('Loading configurator\u2026')}
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div class="cw-root" key={lang}>
        <div class="cw-error">
          ⚠ {state.message}
        </div>
      </div>
    )
  }

  if (state.phase === 'success') {
    return (
      <div class="cw-root" key={lang}>
        <div class="cw-success">
          <div class="cw-success-icon">✓</div>
          <h3>{t('Inquiry sent!')}</h3>
          <p>{t("Thank you. We'll get back to you as soon as possible.")}</p>
        </div>
        <div class="cw-branding">
          <LangSwitcher />
          <a href="https://konfigurator.app" target="_blank" rel="noopener">
            {t('Powered by Konfigurator')}
          </a>
        </div>
      </div>
    )
  }

  const { product, characteristics, assets } = state.data

  return (
    <div class="cw-root" key={lang}>
      {/* Product image */}
      <Visualization assets={assets} selection={selection} />

      <div class="cw-body">
        {/* Product info */}
        <div class="cw-product-name">{product.name}</div>
        {product.description && (
          <div class="cw-product-desc">{product.description}</div>
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
              />
            ))}
          </div>
        )}

        {/* Price */}
        <div class="cw-price-bar">
          <span class="cw-price-label">{t('Total price')}</span>
          <span>
            <span class="cw-price-value">{totalPrice.toFixed(2)}</span>
            <span class="cw-price-currency">{product.currency}</span>
          </span>
        </div>

        {/* CTA */}
        {!showForm && (
          <button
            class="cw-form-toggle"
            onClick={() => setShowForm(true)}
            disabled={!allSelected}
          >
            {allSelected ? t('Request a quote') : t('Select all options to continue')}
          </button>
        )}

        {/* Inquiry form */}
        {showForm && (
          <InquiryForm
            config={config}
            productId={product.id}
            tenantId={config.tenantId}
            lineItems={lineItems}
            totalPrice={totalPrice}
            currency={product.currency}
            onSuccess={() => setState({ phase: 'success' })}
          />
        )}
      </div>

      <div class="cw-branding">
        <LangSwitcher />
        <a href="https://konfigurator.app" target="_blank" rel="noopener">
          {t('Powered by Konfigurator')}
        </a>
      </div>
    </div>
  )
}
