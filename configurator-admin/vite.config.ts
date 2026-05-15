import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry only when SENTRY_AUTH_TOKEN is set (CI/prod builds)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org:       process.env.SENTRY_ORG,
          project:   process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          telemetry: false,
        })]
      : []),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      // The test harness is a separate HTML entry that exposes document
      // generators on `window.__testHarness` for Playwright. The Vite dev
      // server always serves test-harness.html (any HTML in the root is
      // reachable); production builds only emit it when BUILD_HARNESS=1,
      // which CI / Vercel never sets.
      input: process.env.BUILD_HARNESS
        ? {
            main:    path.resolve(__dirname, 'index.html'),
            harness: path.resolve(__dirname, 'test-harness.html'),
          }
        : {
            main: path.resolve(__dirname, 'index.html'),
          },
    },
  },
})
