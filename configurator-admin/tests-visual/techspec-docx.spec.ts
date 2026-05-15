import { test, expect } from '@playwright/test'
import { extractDocxText } from './helpers/docxText'

test.describe('Technical Specification DOCX', () => {
  for (const lang of ['en', 'sr'] as const) {
    test(`content (${lang})`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (err) => pageErrors.push(err.message))

      await page.goto('/test-harness.html')
      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).__testHarness.ready
      })

      const b64: string = await page.evaluate(async (l) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__testHarness.generateTechSpecDocxB64(l)
      }, lang)

      expect(pageErrors, pageErrors.join('\n')).toEqual([])
      expect(b64.length).toBeGreaterThan(0)

      const text = await extractDocxText(b64)

      // Cover: title + tenant + customer + reference
      if (lang === 'en') {
        expect(text).toContain('Technical Specification')
        expect(text).toContain('Prepared for')
      } else {
        expect(text).toContain('Tehnička specifikacija')
        expect(text).toContain('Pripremljeno za')
      }
      // tenant.name is uppercased on the cover when logo_url is null
      expect(text).toContain('ACME FURNITURE WORKSHOP')
      expect(text).toContain('Jovan Marković')
      expect(text).toContain('Q-2026-0042')

      // Chapters: every product appears as a chapter heading + characteristics
      expect(text).toContain('Studio Desk 140')
      expect(text).toContain('Office Chair Pro')
      // Characteristic labels + selected values appear inside the chapters
      expect(text).toContain('Material')
      expect(text).toContain('Oak')
      expect(text).toContain('Walnut')

      // Specification slot text (configured via tenant_texts at characteristic_value level)
      if (lang === 'en') {
        expect(text).toContain('medium density')   // Oak specification (en)
      } else {
        expect(text).toContain('srednja gustoća')  // Oak specification (sr)
      }
    })
  }
})
