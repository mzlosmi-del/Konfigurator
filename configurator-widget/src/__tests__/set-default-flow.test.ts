import { describe, it, expect } from 'vitest'
import { evaluateRules, applyDefaultValues, sanitizeSelection } from '../rules'
import type { ConfigurationRule, Selection } from '../types'

const charA = 'char-a'
const charB = 'char-b'
const charC = 'char-c'
const valX  = 'val-x'
const valY  = 'val-y'
const valZ  = 'val-z'
const valW  = 'val-w'

// Rule: IF charA = X → DEFAULT charB = Y
const defaultRule: ConfigurationRule = {
  id: 'rule-default',
  rule_type: 'set_value_default',
  condition: { characteristic_id: charA, value_id: valX },
  effect:    { characteristic_id: charB, value_id: valY },
  is_active: true,
}

// Simulate the full handleSelect flow
function simulateHandleSelect(
  rules: ConfigurationRule[],
  currentSelection: Selection,
  prevDefaults: Record<string, string>,
  charId: string,
  valueId: string
): { nextSelection: Selection; nextPrevDefaults: Record<string, string> } {
  const next    = { ...currentSelection, [charId]: valueId }
  const effect  = evaluateRules(rules, next)
  const withDef = applyDefaultValues(next, effect, new Set([charId]), prevDefaults)
  const sanitized = sanitizeSelection(withDef, effect)
  return { nextSelection: sanitized, nextPrevDefaults: effect.defaultValues }
}

describe('set_value_default — user can override after trigger', () => {
  it('auto-sets charB when charA condition fires', () => {
    let sel: Selection = { [charA]: valZ, [charB]: valW } // initial, condition not met
    let prevDefs: Record<string, string> = {}

    const r = simulateHandleSelect([defaultRule], sel, prevDefs, charA, valX)
    sel = r.nextSelection
    prevDefs = r.nextPrevDefaults

    expect(sel[charA]).toBe(valX)
    expect(sel[charB]).toBe(valY) // default fired
  })

  it('user can override charB after default is applied', () => {
    // Step 1: trigger the rule
    let sel: Selection = { [charA]: valZ, [charB]: valW }
    let prevDefs: Record<string, string> = {}
    let r = simulateHandleSelect([defaultRule], sel, prevDefs, charA, valX)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults

    // Step 2: user manually changes charB to Z
    r = simulateHandleSelect([defaultRule], sel, prevDefs, charB, valZ)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults

    expect(sel[charB]).toBe(valZ) // user override preserved
  })

  it('charB stays at user override when a third char is clicked', () => {
    // Step 1: trigger the rule
    let sel: Selection = { [charA]: valZ, [charB]: valW, [charC]: valW }
    let prevDefs: Record<string, string> = {}
    let r = simulateHandleSelect([defaultRule], sel, prevDefs, charA, valX)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults

    // Step 2: user overrides charB
    r = simulateHandleSelect([defaultRule], sel, prevDefs, charB, valZ)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults

    // Step 3: user clicks charC (unrelated char)
    r = simulateHandleSelect([defaultRule], sel, prevDefs, charC, valW)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults

    expect(sel[charB]).toBe(valZ) // override still preserved ← this was the bug
  })

  it('re-fires default when condition turns off then on again', () => {
    let sel: Selection = { [charA]: valZ, [charB]: valW }
    let prevDefs: Record<string, string> = {}

    // Trigger
    let r = simulateHandleSelect([defaultRule], sel, prevDefs, charA, valX)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults
    expect(sel[charB]).toBe(valY)

    // User overrides
    r = simulateHandleSelect([defaultRule], sel, prevDefs, charB, valZ)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults
    expect(sel[charB]).toBe(valZ)

    // Turn condition off
    r = simulateHandleSelect([defaultRule], sel, prevDefs, charA, valW)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults
    expect(prevDefs).toEqual({}) // no active defaults

    // Turn condition on again — default should re-fire
    r = simulateHandleSelect([defaultRule], sel, prevDefs, charA, valX)
    sel = r.nextSelection; prevDefs = r.nextPrevDefaults
    expect(sel[charB]).toBe(valY) // default re-applied ✓
  })
})
