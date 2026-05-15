import { defineConfig, devices } from '@playwright/test'

const PORT = 3000

export default defineConfig({
  testDir: './tests-visual',
  fullyParallel: false,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Visual diffs are sensitive to retries (a flake gets re-recorded against
    // a slightly different image), so retries are off by default.
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 60_000,
    // src/lib/supabase.ts throws at module-load if these are unset. The
    // harness imports generators that transitively import supabase, but never
    // actually calls it — so dummy strings just need to satisfy the truthy
    // check. Real dev (without Playwright) still uses your real .env.local.
    env: {
      VITE_SUPABASE_URL:      'http://test-harness.invalid',
      VITE_SUPABASE_ANON_KEY: 'test-harness-anon-key',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
