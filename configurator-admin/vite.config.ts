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
})
