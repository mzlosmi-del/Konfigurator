import { h } from 'preact'
import { useState, useEffect, useMemo, useRef } from 'preact/hooks'
import type { FullProductConfig, Selection, NumericInputs, TextInputs, ColorInputs, WidgetConfig, ConfigLineItem, Characteristic } from '../types'
import { isNumericInRange } from '../types'
import { loadProductConfig } from '../api'
import { evaluateRules, calculatePrice, buildOptionBreakdown, sanitizeSelection, applyDefaultValues, applyNumericDefaults } from '../rules'
import { calculateFormulaTotal, calculateFormulaBreakdown } from '../formulaEngine'
import { t, getLang, setLang, ENABLED_LANGS, OTHER_LANGS, pickTranslation, type Lang } from '../i18n'
import { Visualization } from './Visualization'
import { CharacteristicInput } from './CharacteristicInput'
import { NeonPreview } from './NeonPreview'
import { InquiryForm } from './InquiryForm'
import { isNeonEnabled, resolveGlowHex, resolveValueHex, isPerCharColors, describeNeonColors, offeredScenes, describeNeonScene } from '../neon'
import { getNeonFont } from '../neonFonts'
import { getNeonScene, neonSceneBackground } from '../neonScenes'
import { ensureNeonFonts } from '../fonts'

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
  const [textInputs, setTextInputs] = useState<TextInputs>({})
  const [colorInputs, setColorInputs] = useState<ColorInputs>({})
  // Per-neon-characteristic selected font key (charId → font key). Empty until
  // the customer picks one; the input then falls back to the first enabled font.
  const [neonFonts, setNeonFonts] = useState<Record<string, string>>({})
  // Per-character glow colours for per-char-colour neon chars:
  //   neonCharColors[charId][charIndex] = hex.  Absent index ⇒ default glow.
  const [neonCharColors, setNeonCharColors] = useState<Record<string, Record<number, string>>>({})
  // Which character index is currently selected for painting, per neon char.
  const [neonSelectedChar, setNeonSelectedChar] = useState<Record<string, number | null>>({})
  // Chosen background scene per neon char (charId → scene key). Absent ⇒ the
  // first offered scene (or the plain panel when none are offered).
  const [neonScene, setNeonScene] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
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
        setActiveTab(0)

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

  // Lazy-load the neon web fonts: only when the product actually has a
  // neon-enabled text characteristic. Injected once into document.head (the
  // helper dedupes), so non-neon products fetch nothing extra.
  useEffect(() => {
    if (state.phase !== 'ready') return
    const keys = new Set<string>()
    for (const char of state.data.characteristics) {
      if (isNeonEnabled(char)) {
        for (const k of char.neon_config?.fonts ?? []) {
          if (getNeonFont(k)) keys.add(k)
        }
      }
    }
    if (keys.size > 0) ensureNeonFonts([...keys])
  }, [state])

  function handleNeonFontChange(charId: string, fontKey: string) {
    setNeonFonts(prev => ({ ...prev, [charId]: fontKey }))
  }

  // Per-character colouring: select a character to paint, then paint it.
  function handleSelectNeonChar(charId: string, index: number) {
    setNeonSelectedChar(prev => ({
      ...prev,
      // Clicking the already-selected character deselects it (toggle).
      [charId]: prev[charId] === index ? null : index,
    }))
  }

  function handlePaintNeonChar(charId: string, hex: string) {
    const index = neonSelectedChar[charId]
    if (index == null) return
    setNeonCharColors(prev => ({
      ...prev,
      [charId]: { ...(prev[charId] ?? {}), [index]: hex },
    }))
  }

  // Unified colour control: when the customer changes the bound colour
  // characteristic AND a single letter is selected on a per-char neon text,
  // route the chosen colour to ONLY that letter instead of the whole word.
  // Returns true when it handled the change (so the caller skips the normal
  // global colour update). `picked` is a hex (color picker) or a value id.
  function paintSelectedLetterFromColorChar(colorCharId: string, picked: string): boolean {
    if (state.phase !== 'ready') return false
    for (const char of state.data.characteristics) {
      if (!isPerCharColors(char)) continue
      if (char.neon_config!.colorCharId !== colorCharId) continue
      const index = neonSelectedChar[char.id]
      if (index == null) return false           // no letter selected → whole-word
      const colorChar = state.data.characteristics.find(c => c.id === colorCharId)
      const hex = resolveValueHex(char.neon_config!, colorChar, picked)
      if (!hex) return false
      handlePaintNeonChar(char.id, hex)
      return true
    }
    return false
  }

  function handleSelectNeonScene(charId: string, sceneKey: string) {
    setNeonScene(prev => ({ ...prev, [charId]: sceneKey }))
  }

  function handleSelect(charId: string, valueId: string) {
    if (state.phase !== 'ready') return
    track('characteristic_changed', { char_id: charId, value_id: valueId })
    // If a letter is selected on a per-char neon bound to this colour/swatch
    // char, paint only that letter and leave the global selection untouched.
    if (valueId && paintSelectedLetterFromColorChar(charId, valueId)) return
    // Empty valueId = deselect (used by boolean characteristics when the
    // checkbox is unchecked).
    const next: Selection = { ...selection }
    if (valueId) next[charId] = valueId
    else delete next[charId]
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

  // Text characteristics: store the typed string, and mirror its character
  // count into numericInputs so length-based formulas/rules react exactly like
  // a 'number' characteristic would.
  function handleTextInput(charId: string, value: string) {
    if (state.phase !== 'ready') return
    setTextInputs(prev => ({ ...prev, [charId]: value }))
    handleNumericInput(charId, value.length)
  }

  function handleColorInput(charId: string, value: string) {
    if (state.phase !== 'ready') return
    track('characteristic_changed', { char_id: charId })
    // If a letter is selected on a per-char neon bound to this colour char,
    // paint only that letter and leave the global glow untouched.
    if (paintSelectedLetterFromColorChar(charId, value)) return
    const nextColors = { ...colorInputs, [charId]: value }
    setColorInputs(nextColors)
    // Re-evaluate rules so colour selection can satisfy select_eq-style
    // predicates in the future; current rule predicates don't read colours,
    // but keeping this consistent avoids stale ruleEffect.
    const effect = evaluateRules(state.data.rules, selection, numericInputs)
    prevDefaultsRef.current        = effect.defaultValues
    prevNumericDefaultsRef.current = effect.defaultNumericValues
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const ruleEffect = useMemo(() => {
    if (state.phase !== 'ready') {
      return { hiddenValues: new Set<string>(), disabledValues: new Set<string>(), priceOverrides: {}, defaultValues: {}, lockedValues: {}, defaultNumericValues: {}, lockedNumericValues: {} }
    }
    return evaluateRules(state.data.rules, selection, numericInputs)
  }, [state, selection, numericInputs])

  // Built-in per-character text charges + flat colour fees. Formula-driven
  // text-length pricing flows through calculateFormulaTotal (length lives in
  // numericInputs); these are the formula-free built-ins.
  const textColorAdj = useMemo(() => {
    if (state.phase !== 'ready') return 0
    let extra = 0
    for (const char of state.data.characteristics) {
      if (char.display_type === 'text') {
        extra += (textInputs[char.id]?.length ?? 0) * (char.price_per_char ?? 0)
      } else if (char.display_type === 'color') {
        if (colorInputs[char.id]) extra += char.color_price_modifier ?? 0
      }
    }
    return extra
  }, [state, textInputs, colorInputs])

  const totalPrice = useMemo(() => {
    if (state.phase !== 'ready') return 0
    const base        = calculatePrice(state.data.product.base_price, selection, state.data.characteristics, ruleEffect.priceOverrides)
    const formulaAdj  = calculateFormulaTotal(state.data.formulas, {
      base_price:      state.data.product.base_price,
      selection,
      numericInputs,
      characteristics: state.data.characteristics,
    })
    return Math.max(0, base + formulaAdj + textColorAdj)
  }, [state, selection, numericInputs, ruleEffect, textColorAdj])

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
      // Text: store the typed string; price is the per-character built-in.
      if (char.display_type === 'text') {
        const text = textInputs[char.id] ?? ''
        if (text.length > 0) {
          // For neon, append readable notes so the shop can reproduce the sign:
          // the chosen background scene and any per-character colours. Visual
          // only — price is unchanged.
          let valueLabel = text
          if (isNeonEnabled(char)) {
            const notes: string[] = []
            const scenes = offeredScenes(char.neon_config!)
            if (scenes.length > 0) {
              const sceneLabel = describeNeonScene(neonScene[char.id] ?? scenes[0])
              if (sceneLabel) notes.push(`Background: ${sceneLabel}`)
            }
            if (isPerCharColors(char)) {
              const colourNote = describeNeonColors(text, neonCharColors[char.id])
              if (colourNote) notes.push(colourNote)
            }
            if (notes.length > 0) valueLabel = `${text} (${notes.join('; ')})`
          }
          items.push({ characteristic_name: charName, value_label: valueLabel, price_modifier: text.length * (char.price_per_char ?? 0) })
        }
        continue
      }
      // Color: store the chosen hex; price is the flat colour modifier.
      if (char.display_type === 'color') {
        const hex = colorInputs[char.id]
        if (hex) {
          items.push({ characteristic_name: charName, value_label: hex, price_modifier: char.color_price_modifier ?? 0 })
        }
        continue
      }
      if (!selection[char.id]) continue
      const v = char.values.find(val => val.id === selection[char.id])
      if (!v) continue
      // Boolean: only the characteristic name is meaningful — the value's
      // label is admin-only. Emit an empty value_label so renderers know to
      // show just the name.
      const valueLabel = char.display_type === 'boolean'
        ? ''
        : pickTranslation(v.label_i18n, lang, v.label)
      items.push({ characteristic_name: charName, value_label: valueLabel, price_modifier: v.price_modifier })
    }

    return items
  }, [state, selection, numericInputs, textInputs, colorInputs, neonCharColors, neonScene, lang])

  const allSelected = useMemo(() => {
    if (state.phase !== 'ready') return false
    return state.data.characteristics.every(c => {
      if (c.display_type === 'number') {
        const val = numericInputs[c.id]
        // Must be entered AND within the optional min/max bounds (migration 088).
        return val !== undefined && isNumericInRange(val, c.numeric_min, c.numeric_max)
      }
      // Boolean characteristics are always optional — leaving the box
      // unchecked must not block submission.
      if (c.display_type === 'boolean') return true
      // Text/colour are optional, but if text is entered it must respect the
      // min/max character-length bounds.
      if (c.display_type === 'text') {
        const text = textInputs[c.id] ?? ''
        return text.length === 0 || isNumericInRange(text.length, c.numeric_min, c.numeric_max)
      }
      if (c.display_type === 'color') return true
      return !!selection[c.id]
    })
  }, [state, selection, numericInputs, textInputs])

  // ── Renders ─────────────────────────────────────────────────────────────────

  function LangSwitcher() {
    return (
      <div class="cw-lang-switcher">
        {/* Available (translated) widget languages — selectable, highlighted. */}
        {ENABLED_LANGS.map(l => (
          <button
            key={l}
            type="button"
            class={`cw-lang-btn${lang === l ? ' cw-lang-btn--active' : ''}`}
            onClick={() => { setLang(l); setLangState(l) }}
          >
            {l.toUpperCase()}
          </button>
        ))}
        {/* Other supported languages — de-emphasized and disabled until a
            translation exists. Marked off from the enabled set by a divider. */}
        {OTHER_LANGS.length > 0 && <span class="cw-lang-divider" aria-hidden="true" />}
        {OTHER_LANGS.map(o => (
          <button
            key={o.code}
            type="button"
            class="cw-lang-btn cw-lang-btn--disabled"
            disabled
            title={`${o.name} — ${t('coming soon')}`}
          >
            {o.code.toUpperCase()}
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
        {state.data.removeBranding && (
          <div class="cw-branding cw-branding--lang-only">
            <LangSwitcher />
          </div>
        )}
      </div>
    )
  }

  const { product, characteristics, assets, assignments, removeBranding, groups } = state.data

  // Tabs are shown only when the product opts in (group_into_tabs) AND has more
  // than one characteristic class. Otherwise the widget renders the flat list
  // exactly as before. The price, completion gate and preview always span the
  // full `characteristics` array regardless of which tab is active.
  const showTabs = !!product.group_into_tabs && groups.length > 1
  const charById = useMemo(
    () => new Map(characteristics.map(c => [c.id, c])),
    [characteristics],
  )
  const visibleChars = useMemo<Characteristic[]>(() => {
    if (!showTabs) return characteristics
    const g = groups[Math.min(activeTab, groups.length - 1)]
    return g.characteristicIds.map(id => charById.get(id)).filter(Boolean) as Characteristic[]
  }, [showTabs, groups, activeTab, characteristics, charById])

  // When the product has a neon-enabled text characteristic, its glowing live
  // preview becomes the hero visual — it replaces the image/3D <Visualization>
  // at the top of the widget. The text input + font picker still render inline
  // among the characteristics (their inline glow is suppressed so it only shows
  // once, up top). Spans the full characteristics array so the hero is stable
  // regardless of the active tab. Plain const (not a hook) to keep hook order
  // unconditional on this code path.
  const neonHeroChar = characteristics.find(isNeonEnabled)
  const neonHero = neonHeroChar
    ? (() => {
        const neon     = neonHeroChar.neon_config!
        const colorChar = neon.colorCharId ? charById.get(neon.colorCharId) : undefined
        const glowHex  = resolveGlowHex(neon, colorChar, selection, colorInputs)
        const fontKeys = (neon.fonts ?? []).filter(k => getNeonFont(k))
        const fontKey  = neonFonts[neonHeroChar.id] ?? fontKeys[0]
        const perChar  = isPerCharColors(neonHeroChar)
        const scenes   = offeredScenes(neon)
        const sceneKey = neonScene[neonHeroChar.id] ?? scenes[0]
        return {
          charId:      neonHeroChar.id,
          text:        textInputs[neonHeroChar.id] ?? '',
          placeholder: t('Your text'),
          glowHex,
          fontKey,
          perChar,
          // Live per-char state. Painting now happens via the bound colour
          // control (whole word, or the selected letter) — no separate palette.
          charColors:    neonCharColors[neonHeroChar.id] ?? {},
          selectedIndex: neonSelectedChar[neonHeroChar.id] ?? null,
          // Offered background scenes and the currently-chosen one.
          scenes,
          sceneKey,
        }
      })()
    : null

  // Display-only selection for the 3D preview: before the customer picks
  // anything, mesh-visibility rules would hide every configurable mesh and the
  // model would look empty. Fill each unset characteristic with one value —
  // the rule-driven default if a rule sets one, otherwise the first value by
  // sort order — so the model renders whole on first paint. This never feeds
  // price, the form, or the "all selected" gate; it's purely what the 3D
  // viewer shows. Real selections always take precedence.
  //
  // Boolean characteristics are excluded: an unchecked boolean is a deliberate
  // "off" state, not an unset value awaiting a default. Auto-filling it would
  // pin its value into previewSelection permanently, so toggling the checkbox
  // would never change the model.
  const previewSelection = useMemo<Selection>(() => {
    if (state.phase !== 'ready') return selection
    const previewDefaults = product.preview_defaults ?? {}
    const next: Selection = { ...selection }
    for (const char of characteristics) {
      if (char.display_type === 'number') continue
      if (char.display_type === 'boolean') continue
      if (next[char.id]) continue
      // Precedence: rule default → admin-set preview default → first value by
      // sort order. The admin default is only honoured if it still points at a
      // value this characteristic owns (stale ids fall through to the first).
      const ruleDefault    = ruleEffect.defaultValues[char.id]
      const adminDefaultId = previewDefaults[char.id]
      const adminDefault   = char.values.some(v => v.id === adminDefaultId) ? adminDefaultId : undefined
      const fallback       = char.values[0]?.id   // values arrive sorted by sort_order
      const chosen = ruleDefault ?? adminDefault ?? fallback
      if (chosen) next[char.id] = chosen
    }
    return next
  }, [state, selection, characteristics, ruleEffect, product.preview_defaults])

  return (
    <div class="cw-root">
      {/* Hero visual: the neon glow preview takes the place of the product
          image/3D when a neon text characteristic is present; otherwise the
          normal visualization renders unchanged. */}
      {neonHero
        ? (
          <div class="cw-neon-hero">
            <NeonPreview
              text={neonHero.text}
              placeholder={neonHero.placeholder}
              glowHex={neonHero.glowHex}
              fontKey={neonHero.fontKey}
              perChar={neonHero.perChar}
              charColors={neonHero.charColors}
              selectedIndex={neonHero.selectedIndex}
              onSelectChar={(i) => handleSelectNeonChar(neonHero.charId, i)}
              sceneKey={neonHero.sceneKey}
            />
            {/* Background-scene picker: thumbnails that swap the backdrop live. */}
            {neonHero.scenes.length > 0 && (
              <div class="cw-neon-scenes" role="group" aria-label={t('Background')}>
                {neonHero.scenes.map(key => {
                  const sc = getNeonScene(key)
                  if (!sc) return null
                  const bg = neonSceneBackground(key)
                  const selected = neonHero.sceneKey === key
                  return (
                    <button
                      key={key}
                      type="button"
                      class={`cw-neon-scene-btn${selected ? ' selected' : ''}`}
                      title={sc.label}
                      style={bg ? `background-image:${bg};` : ''}
                      onClick={() => handleSelectNeonScene(neonHero.charId, key)}
                    >
                      <span class="cw-neon-scene-name">{sc.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {/* Per-character colouring hint: the colour control below now paints
                the selected letter, or the whole sign when nothing is selected. */}
            {neonHero.perChar && (
              <div class="cw-neon-painter">
                <div class="cw-neon-painter-hint">
                  {neonHero.selectedIndex != null
                    ? t('Choose a colour below — it applies to the selected letter. Tap the letter again for the whole sign.')
                    : t('Tap a letter to colour just that one, or choose a colour for the whole sign.')}
                </div>
              </div>
            )}
          </div>
        )
        : (
          <Visualization assets={assets} assignments={assignments} selection={selection} previewSelection={previewSelection} numericInputs={numericInputs} arEnabled={product.ar_enabled} arPlacement={product.ar_placement ?? 'floor'} />
        )}

      <div class="cw-body">
        {/* Product info */}
        <div class="cw-product-name">{pickTranslation(product.name_i18n, lang, product.name)}</div>
        {product.description && (
          <div class="cw-product-desc">{pickTranslation(product.description_i18n, lang, product.description)}</div>
        )}

        {/* Characteristic tabs — one per assigned class, shown only when there
            is more than one group. */}
        {showTabs && (
          <div class="cw-tabs" role="tablist">
            {groups.map((g, i) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={i === activeTab}
                class={`cw-tab${i === activeTab ? ' cw-tab--active' : ''}`}
                onClick={() => { setActiveTab(i); track('tab_changed', { class_id: g.id, index: i }) }}
              >
                {pickTranslation(g.name_i18n, lang, g.name)}
              </button>
            ))}
          </div>
        )}

        {/* Characteristics — filtered to the active tab when tabs are shown. */}
        {visibleChars.length > 0 && (
          <div class="cw-characteristics">
            {visibleChars.map(char => {
              // Resolve the live glow colour for neon-enabled text characteristics
              // from the bound sibling colour/swatch characteristic. Non-neon
              // characteristics ignore these props entirely.
              const neon = isNeonEnabled(char) ? char.neon_config! : null
              const glowHex = neon
                ? resolveGlowHex(neon, neon.colorCharId ? charById.get(neon.colorCharId) : undefined, selection, colorInputs)
                : undefined
              return (
                <CharacteristicInput
                  key={char.id}
                  characteristic={char}
                  selectedValueId={selection[char.id]}
                  ruleEffect={ruleEffect}
                  numericInputs={numericInputs}
                  textInputs={textInputs}
                  colorInputs={colorInputs}
                  onChange={handleSelect}
                  onNumericInput={handleNumericInput}
                  onTextInput={handleTextInput}
                  onColorInput={handleColorInput}
                  lang={lang}
                  neonGlowHex={glowHex}
                  neonFontKey={neonFonts[char.id]}
                  onNeonFontChange={handleNeonFontChange}
                  /* The hero char's glow shows at the top; suppress its inline
                     duplicate (input + font picker still render). */
                  showInlineNeonPreview={!neonHeroChar || char.id !== neonHeroChar.id}
                />
              )
            })}
          </div>
        )}

        {/* Pricing breakdown — gated by the per-product setting so operators
            can opt to show the final total only. */}
        {priceBreakdown && product.show_price_breakdown && (() => {
          const rows: Array<{ label: string; amount: number }> = []
          rows.push({ label: t('Base price'), amount: priceBreakdown.base })
          for (const opt of priceBreakdown.options) {
            if (opt.amount === 0) continue
            const char = characteristics.find(c => c.id === opt.char_id)
            if (!char) continue
            const charName = pickTranslation(char.name_i18n, lang, char.name)
            const value = char.values.find(v => v.id === opt.value_id)
            const valueLabel = (char.display_type === 'boolean' || !value)
              ? ''
              : pickTranslation(value.label_i18n, lang, value.label)
            rows.push({ label: valueLabel ? `${charName}: ${valueLabel}` : charName, amount: opt.amount })
          }
          // Built-in text (per-character) and colour (flat) charges.
          for (const char of characteristics) {
            const charName = pickTranslation(char.name_i18n, lang, char.name)
            if (char.display_type === 'text') {
              const amount = (textInputs[char.id]?.length ?? 0) * (char.price_per_char ?? 0)
              if (amount !== 0) rows.push({ label: charName, amount })
            } else if (char.display_type === 'color') {
              const amount = colorInputs[char.id] ? (char.color_price_modifier ?? 0) : 0
              if (amount !== 0) rows.push({ label: charName, amount })
            }
          }
          for (const f of priceBreakdown.formulas) {
            if (f.amount === 0) continue
            rows.push({ label: pickTranslation(f.name_i18n, lang, f.name), amount: f.amount })
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
            uploadsEnabled={product.uploads_possible === true}
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
                  {item.value_label && <span class="cw-chip-val">{item.value_label}</span>}
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
          <p class="cw-bar-price-disclaimer">
            {t('This is an estimated price. The official quote will be provided by the company after your inquiry.')}
          </p>
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
      {removeBranding && (
        <div class="cw-branding cw-branding--lang-only">
          <LangSwitcher />
        </div>
      )}
    </div>
  )
}
