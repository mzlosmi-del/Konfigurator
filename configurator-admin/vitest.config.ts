import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Vitest's default `include` picks up `**/*.spec.ts`, which sweeps in
    // the Playwright tests in tests-visual/. Limit vitest to src/ so the
    // two runners stay disjoint.
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['node_modules', 'dist', 'tests-visual'],
    environment: 'jsdom',
  },
})
