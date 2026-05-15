import { test, expect } from '@playwright/test'

test('harness loads and ready resolves', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  await page.goto('/test-harness.html')

  const ok = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).__testHarness.ready
    return true
  })
  expect(ok).toBe(true)

  await expect(page.locator('#status')).toHaveText('Harness ready')

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
})
