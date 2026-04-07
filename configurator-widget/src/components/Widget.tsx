import { h } from 'preact'
import { useState, useEffect, useMemo } from 'preact/hooks'
import type { FullProductConfig, Selection, WidgetConfig, ConfigLineItem } from '../types'
import { loadProductConfig } from '../api'
import { evaluateRules, calculatePrice, sanitizeSelection } from '../rules'
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
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadProductConfig(config)
      .then(data => {
        setState({ phase: 'ready', data })
        // Pre-select first value of each characteristic
        const initial: Selection = {}
        for (const char of data.characteristics) {
          if (char.values.length > 0) {
            initial[char.id] = char.values[0].id
          }
        }
        setSelection(initial)
      })
      .catch(err => {
        setState({ phase: 'error', message: err.message })
      })
  }, [config.productId])

  function handleSelect(charId: string, valueId: string) {
    if (state.phase !== 'ready') return

    const next = { ...selection, [charId]: valueId }

    // Evaluate rules and sanitize (remove any newly-disabled selections)
    const effect = evaluateRules(state.data.rules, next)
    const sanitized = sanitizeSelection(next, effect)

    setSelection(sanitized)
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const ruleEffect = useMemo(() => {
    if (state.phase !== 'ready') return { hiddenValues: new Set<string>(), disabledValues: new Set<string>(), priceOverrides: {} }
    return evaluateRules(state.data.rules, selection)
  }, [state, selection])

  const totalPrice = useMemo(() => {
    if (state.phase !== 'ready') return 0
    return calculatePrice(
      state.data.product.base_price,
      selection,
      state.data.characteristics,
      ruleEffect.priceOverrides
    )
  }, [state, selection, ruleEffect])

  const lineItems = useMemo((): ConfigLineItem[] => {
    if (state.phase !== 'ready') return []
    return state.data.characteristics
      .filter(c => !!selection[c.id])
      .map(c => {
        const v = c.values.find(val => val.id === selection[c.id])
        return {
          characteristic_name: c.name,
          value_label: v?.label ?? '',
          price_modifier: v?.price_modifier ?? 0,
        }
      })
  }, [state, selection])

  const allSelected = useMemo(() => {
    if (state.phase !== 'ready') return false
    return state.data.characteristics.every(c => !!selection[c.id])
  }, [state, selection])

  // ── Renders ─────────────────────────────────────────────────────────────────

  if (state.phase === 'loading') {
    return (
      <div class="cw-root">
        <div class="cw-loading">
          <div class="cw-spinner" />
          Loading configurator…
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
          <h3>Inquiry sent!</h3>
          <p>Thank you. We'll get back to you as soon as possible.</p>
        </div>
        <div class="cw-branding">
          <a href="https://konfigurator.app" target="_blank" rel="noopener">
            Powered by Konfigurator
          </a>
        </div>
      </div>
    )
  }

  const { product, characteristics, assets } = state.data

  return (
    <div class="cw-root">
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
                onChange={handleSelect}
              />
            ))}
          </div>
        )}

        {/* Price */}
        <div class="cw-price-bar">
          <span class="cw-price-label">Total price</span>
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
            {allSelected ? 'Request a quote' : 'Select all options to continue'}
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
        <a href="https://konfigurator.app" target="_blank" rel="noopener">
          Powered by Konfigurator
        </a>
      </div>
    </div>
  )
}
