import { describe, it, expect } from 'vitest'
import { evaluateRules, applyDefaultValues, sanitizeSelection } from '@/lib/configurationRules'
import type { ConfigurationRule } from '@/types/database'

const charA = 'char-a'
const charB = 'char-b'
const charC = 'char-c'
const valX  = 'val-x'
const valY  = 'val-y'
const valZ  = 'val-z'
const valW  = 'val-w'

const defaultRule: ConfigurationRule = {
  id:         'rule-1',
  product_id: 'prod-1',
  rule_type:  'set_value_default',
  condition:  { characteristic_id: charA, value_id: valX },
  effect:     { characteristic_id: charB, value_id: valY },
  is_active:  true,
  created_at: '',
}

// Simulate the handleSelect + prevDefaultsRef logic from ConfigureProductDialog
function simulateSelect(
  rules: ConfigurationRule[],
  selection: Record<string, string>,
  prevDefaults: Record<string, string>,
  charId: string,
  valueId: string
): { sel: Record<string, string>; prev: Record<string, string> } {
  const next   = { ...selection, [charId]: valueId }
  const effect = evaluateRules(rules, next)
  const withDef = applyDefaultValues(next, effect, new Set([charId]), prevDefaults)
  const sel    = sanitizeSelection(withDef, effect)
  return { sel, prev: effect.defaultValues }
}

describe('set_value_default — admin dialog simulation', () => {
  it('auto-sets charB when charA = X is selected', () => {
    let sel: Record<string, string> = {}
    let prev: Record<string, string> = {}

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charA, valX))

    expect(sel[charA]).toBe(valX)
    expect(sel[charB]).toBe(valY) // default fired
  })

  it('user can override charB after it was auto-set', () => {
    let sel: Record<string, string> = {}
    let prev: Record<string, string> = {}

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charA, valX))
    expect(sel[charB]).toBe(valY)

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charB, valZ))
    expect(sel[charB]).toBe(valZ) // user override preserved
  })

  it('charB stays at user value when charC is clicked (was the bug)', () => {
    let sel: Record<string, string> = { [charC]: valW }
    let prev: Record<string, string> = {}

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charA, valX))
    expect(sel[charB]).toBe(valY)

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charB, valZ))
    expect(sel[charB]).toBe(valZ)

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charC, valW)) // click unrelated char
    expect(sel[charB]).toBe(valZ) // must stay Z — NOT revert to Y
  })

  it('default re-fires if condition turns off then on', () => {
    let sel: Record<string, string> = {}
    let prev: Record<string, string> = {}

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charA, valX))
    expect(sel[charB]).toBe(valY)

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charB, valZ))
    expect(sel[charB]).toBe(valZ) // user set Z

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charA, valW)) // condition OFF
    expect(prev).toEqual({})

    ;({ sel, prev } = simulateSelect([defaultRule], sel, prev, charA, valX)) // condition ON again
    expect(sel[charB]).toBe(valY) // default re-fires ✓
  })

  it('dialog-open path: applies current defaults from initialSelection', () => {
    // Simulates the useEffect on dialog open
    const initialSelection = { [charA]: valX, [charB]: valW }
    const effect = evaluateRules([defaultRule], initialSelection)
    // prevDefaultValues = {} → all active defaults fire
    const withDef = applyDefaultValues(initialSelection, effect)
    const sel = sanitizeSelection(withDef, effect)

    expect(sel[charB]).toBe(valY) // charB overridden by default on open
  })
})
