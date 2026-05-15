import { test, expect } from '@playwright/test'

const TEMPLATES = ['modern', 'classic', 'compact', 'bold'] as const
const LANGS     = ['en', 'sr'] as const

for (const template of TEMPLATES) {
  for (const lang of LANGS) {
    test(`PDF ${template} × ${lang}`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (err) => pageErrors.push(err.message))

      await page.goto('/test-harness.html')
      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).__testHarness.ready
      })

      const b64: string = await page.evaluate(async (opts) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__testHarness.generatePdfB64(opts)
      }, { template, lang })

      const { pageCount } = await page.evaluate(async (b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__testHarness.renderPdfToCanvases(b)
      }, b64)

      expect(pageErrors, pageErrors.join('\n')).toEqual([])
      expect(pageCount).toBeGreaterThan(0)

      for (let i = 1; i <= pageCount; i++) {
        const canvas = page.locator(`#pdf-canvases canvas[data-page="${i}"]`)
        await expect(canvas).toHaveScreenshot(`${template}-${lang}-p${i}.png`)
      }
    })
  }
}
