import { test, expect } from '@playwright/test'
import { extractDocxText } from './helpers/docxText'

test.describe('quotation DOCX', () => {
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
        return (window as any).__testHarness.generateQuotationDocxB64(l)
      }, lang)

      expect(pageErrors, pageErrors.join('\n')).toEqual([])
      expect(b64.length).toBeGreaterThan(0)

      const text = await extractDocxText(b64)

      // Tenant + reference. quotationDocx.ts:142/177 render tenant.name in
      // uppercase; also stash original-case in the file's `creator` field
      // which lives outside word/document.xml.
      expect(text).toContain('ACME FURNITURE WORKSHOP')
      expect(text).toContain('Q-2026-0042')
      // Customer
      expect(text).toContain('Jovan Marković')
      expect(text).toContain('Markovic Studios')
      // Both products
      expect(text).toContain('Studio Desk 140')
      expect(text).toContain('Office Chair Pro')
      // Both characteristics surface in the configuration breakdown
      expect(text).toMatch(/Oak/i)
      expect(text).toMatch(/Walnut/i)
      // Totals are stringified into the document
      expect(text).toMatch(/2800[.,]00\s*EUR/)
      expect(text).toMatch(/3124[.,]80\s*EUR/)

      // Lang-specific spot check: SR renders Serbian labels somewhere.
      if (lang === 'sr') {
        // payment_terms field label or VAT label rendered in Serbian
        // (PDF_LABELS.sr.totalDue is "Ukupno za plaćanje")
        expect(text).toMatch(/Ukupno|Iznos|ukupno/i)
      } else {
        expect(text).toMatch(/Total|Quotation/i)
      }
    })
  }
})
