import { describe, it, expect } from 'vitest'
import { HeadingNumberer, headingIsNumbered, withNumber } from '@/lib/docTemplate/numbering'

describe('HeadingNumberer — multilevel decimal numbering', () => {
  it('produces 1, 1.1, 1.1.1 style prefixes', () => {
    const n = new HeadingNumberer()
    expect(n.next(1)).toBe('1.')
    expect(n.next(2)).toBe('1.1.')
    expect(n.next(3)).toBe('1.1.1.')
    expect(n.next(3)).toBe('1.1.2.')
    expect(n.next(2)).toBe('1.2.')
    expect(n.next(1)).toBe('2.')
    expect(n.next(2)).toBe('2.1.')
  })

  it('resets deeper levels when a higher level advances', () => {
    const n = new HeadingNumberer()
    n.next(1)        // 1.
    n.next(2)        // 1.1.
    n.next(3)        // 1.1.1.
    expect(n.next(1)).toBe('2.')     // deeper counters reset
    expect(n.next(2)).toBe('2.1.')   // not 2.2.
    expect(n.next(3)).toBe('2.1.1.') // not 2.1.2.
  })

  it('two separate documents have independent counters', () => {
    const a = new HeadingNumberer()
    const b = new HeadingNumberer()
    expect(a.next(1)).toBe('1.')
    expect(b.next(1)).toBe('1.')
  })
})

describe('headingIsNumbered gate', () => {
  it('requires both the doc switch and the per-heading flag', () => {
    expect(headingIsNumbered(true, true)).toBe(true)
    expect(headingIsNumbered(true, false)).toBe(false)
    expect(headingIsNumbered(false, true)).toBe(false)
    expect(headingIsNumbered(undefined, true)).toBe(false)
    expect(headingIsNumbered(true, undefined)).toBe(false)
  })
})

describe('withNumber', () => {
  it('prepends the prefix when present', () => {
    expect(withNumber('1.2.', 'Material')).toBe('1.2. Material')
  })
  it('returns the text unchanged when no prefix', () => {
    expect(withNumber('', 'Material')).toBe('Material')
  })
})
