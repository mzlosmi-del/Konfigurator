import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'ConfiguratorWidget',
      fileName: () => 'widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle everything — no external deps
      external: [],
    },
    // Target modern browsers only (keeps bundle smaller)
    target: 'es2020',
    minify: true,
    cssCodeSplit: false,
  },
  // Dev server — serves a test HTML page
  server: {
    port: 5174,
  },
})
