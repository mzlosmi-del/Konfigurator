import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Provide stub values for Supabase env vars so module-level guards in
  // supabase.ts don't throw when pure-function unit tests import from modules
  // that transitively import supabase.ts.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://stub.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('stub-anon-key'),
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
