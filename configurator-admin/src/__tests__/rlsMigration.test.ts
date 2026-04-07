import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Validate 005 migration SQL structure without connecting to a database.
// Catches accidental reversion to USING (true) in CI.

const migrationPath = resolve(process.cwd(), '../migrations/005_fix_anon_rls_characteristics.sql')
const migration = readFileSync(migrationPath, 'utf8')

describe('migration 005 — anon RLS characteristics', () => {
  it('drops the permissive characteristics policy', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "characteristics: anon reads all"'
    )
  })

  it('drops the permissive characteristic_values policy', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "characteristic_values: anon reads all"'
    )
  })

  it('creates a scoped characteristics policy', () => {
    expect(migration).toContain(
      '"characteristics: anon reads via published product"'
    )
  })

  it('creates a scoped characteristic_values policy', () => {
    expect(migration).toContain(
      '"characteristic_values: anon reads via published product"'
    )
  })

  it('no anon policy uses USING (true) — bug 2', () => {
    // Split into lines, find any that immediately follow a "TO anon" block
    const lines = migration.split('\n')
    let inAnonBlock = false
    for (const line of lines) {
      if (line.trim() === 'TO anon') { inAnonBlock = true; continue }
      if (inAnonBlock) {
        expect(line.trim()).not.toBe('USING (true);')
        inAnonBlock = false
      }
    }
  })

  it('scopes reads through product_characteristics to published products', () => {
    expect(migration).toContain('product_characteristics pc')
    expect(migration).toContain("p.status = 'published'")
  })
})
