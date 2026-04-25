import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [preact()],
  define: {
    __WIDGET_VERSION__: JSON.stringify(version),
  },
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
