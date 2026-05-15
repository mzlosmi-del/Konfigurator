import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs'

test.describe('quotation XLSX', () => {
  for (const lang of ['en', 'sr'] as const) {
    test(`content (${lang})`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('pageerror', (err) => consoleErrors.push(err.message))

      await page.goto('/test-harness.html')
      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).__testHarness.ready
      })

      const b64: string = await page.evaluate(async (l) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__testHarness.generateXlsxB64(l)
      }, lang)

      expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
      expect(b64.length).toBeGreaterThan(0)

      const buffer = Buffer.from(b64, 'base64')
      // ExcelJS expects an ArrayBuffer; copy from Node Buffer to a fresh AB.
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(ab)

      const ws = wb.worksheets[0]
      expect(ws, 'worksheet 0 exists').toBeTruthy()

      // Collect every cell's string value across the sheet.
      const allText: string[] = []
      ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.value
          if (v == null) return
          if (typeof v === 'object' && 'richText' in v) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            allText.push((v as any).richText.map((r: { text: string }) => r.text).join(''))
          } else {
            allText.push(String(v))
          }
        })
      })
      const text = allText.join('\n')

      // Tenant identifies the document. The XLSX renderer uppercases
      // tenant.name (quotationXlsx.ts:159, 170), so match accordingly.
      expect(text).toContain('ACME FURNITURE WORKSHOP')
      // Reference number is rendered
      expect(text).toContain('Q-2026-0042')
      // Customer name appears
      expect(text).toContain('Jovan Marković')
      // Both products are listed
      expect(text).toContain('Studio Desk 140')
      expect(text).toContain('Office Chair Pro')
      // Currency appears at least once
      expect(text).toContain('EUR')

      // Numeric checks: cells are stored as raw numbers + a number-format
      // string. Match against `cell.value`, not the formatted display.
      // NOTE: quotationXlsx.ts:316 renders each line's L-column total as
      // `unit_price * quantity` and does NOT apply line-level adjustments;
      // the subtotal/total cells, however, are rendered as
      // `${quotation.subtotal.toFixed(2)} ${currency}` strings (lines
      // 497, 515), and those values WERE computed with line adjustments by
      // calcSubtotal/calcTotal at the call site. Asserting both behaviours.
      const numbers = new Set<number>()
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'number') numbers.add(cell.value)
        })
      })
      expect(numbers.has(1200), 'desk line cell = unit_price × quantity = 1200').toBe(true)
      expect(numbers.has(1660), 'chair line cell = 4 × 415 = 1660').toBe(true)

      expect(text).toContain('2800.00 EUR')   // subtotal string
      expect(text).toContain('3124.80 EUR')   // total due string
    })
  }
})
