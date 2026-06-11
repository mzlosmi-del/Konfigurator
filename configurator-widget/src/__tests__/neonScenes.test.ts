import { describe, it, expect } from 'vitest'
import { NEON_SCENES, getNeonScene, neonSceneBackground } from '../neonScenes'

describe('neon scene catalogue', () => {
  it('has a none sentinel plus at least 4 real scenes, all unique keys', () => {
    const keys = NEON_SCENES.map(s => s.key)
    expect(keys).toContain('none')
    expect(new Set(keys).size).toBe(keys.length)            // unique
    const real = NEON_SCENES.filter(s => s.key !== 'none')
    expect(real.length).toBeGreaterThanOrEqual(4)
  })

  it('every real scene has a label and non-empty SVG; none has empty SVG', () => {
    for (const s of NEON_SCENES) {
      expect(s.label.length).toBeGreaterThan(0)
      if (s.key === 'none') {
        expect(s.svg).toBe('')
      } else {
        expect(s.svg).toContain('<svg')
        expect(s.svg).toContain('viewBox')
      }
    }
  })

  it('getNeonScene resolves known keys and rejects unknown', () => {
    expect(getNeonScene('bar-wall')?.label).toBe('Bar wall')
    expect(getNeonScene('nope')).toBeUndefined()
    expect(getNeonScene(null)).toBeUndefined()
    expect(getNeonScene(undefined)).toBeUndefined()
  })
})

describe('neonSceneBackground (CSS data-URI)', () => {
  it('returns a url(data:image/svg+xml,...) for a real scene', () => {
    const bg = neonSceneBackground('storefront')
    expect(bg.startsWith('url("data:image/svg+xml,')).toBe(true)
    // '#' must be percent-escaped so it doesn't terminate the data-URI.
    expect(bg).not.toContain('#')
  })

  it('returns empty string for none / unknown / absent', () => {
    expect(neonSceneBackground('none')).toBe('')
    expect(neonSceneBackground('nope')).toBe('')
    expect(neonSceneBackground(undefined)).toBe('')
    expect(neonSceneBackground(null)).toBe('')
  })
})
