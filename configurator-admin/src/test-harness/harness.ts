// Test harness for document-generator visual + content tests.
//
// Loaded by `test-harness.html`, served only by the Vite dev server. Excluded
// from prod builds: see vite.config.ts (the harness HTML is added to
// rollupOptions.input only when BUILD_HARNESS=1), and the runtime guard
// below.
//
// Contract — Playwright tests in tests-visual/ rely on:
//
//   window.__testHarness = {
//     ready:                          Promise<void>
//     generateXlsxB64(lang):          Promise<string>
//     generateQuotationDocxB64(lang): Promise<string>
//     generateTechSpecDocxB64(lang):  Promise<string>
//     generatePdfB64(opts):           Promise<string>
//     renderPdfToCanvases(b64):       Promise<{ pageCount: number }>
//   }

import { tenant, quotation, texts, assets } from '@/__fixtures__/quotationFixture'
import { buildQuotationXlsxBytes }         from '@/lib/quotationXlsx'
import { buildQuotationDocxBytes }         from '@/lib/quotationDocx'
import { buildQuotationTechSpecDocxBytes } from '@/lib/quotationTechSpecDocx'
import { buildQuotationPdfBytes, type PdfTemplate } from '@/lib/quotationPdf'
import * as pdfjsLib from 'pdfjs-dist'
// `?url` asks Vite to resolve to the served URL of the worker bundle.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface GeneratePdfOpts {
  template: PdfTemplate
  lang:     'en' | 'sr'
}

declare global {
  interface Window {
    __testHarness: {
      ready:                       Promise<void>
      generateXlsxB64:             (lang?: 'en' | 'sr') => Promise<string>
      generateQuotationDocxB64:    (lang?: 'en' | 'sr') => Promise<string>
      generateTechSpecDocxB64:     (lang?: 'en' | 'sr') => Promise<string>
      generatePdfB64:              (opts: GeneratePdfOpts) => Promise<string>
      renderPdfToCanvases:         (b64: string) => Promise<{ pageCount: number }>
    }
  }
}

if (import.meta.env.PROD) {
  throw new Error('test-harness loaded in a production build')
}

const setStatus = (msg: string) => {
  const el = document.getElementById('status')
  if (el) el.textContent = msg
}

function bytesToBase64(bytes: Uint8Array): string {
  // chunked to dodge call-stack limits on large buffers
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

const ready: Promise<void> = (async () => {
  setStatus('Harness ready')
})()

async function generateXlsxB64(lang: 'en' | 'sr' = 'en'): Promise<string> {
  const bytes = await buildQuotationXlsxBytes({
    tenant, quotation, texts, lang,
  })
  return bytesToBase64(bytes)
}

async function generateQuotationDocxB64(lang: 'en' | 'sr' = 'en'): Promise<string> {
  const bytes = await buildQuotationDocxBytes({
    tenant, quotation, texts, lang,
  })
  return bytesToBase64(bytes)
}

async function generateTechSpecDocxB64(lang: 'en' | 'sr' = 'en'): Promise<string> {
  const bytes = await buildQuotationTechSpecDocxBytes({
    tenant, quotation, texts, assets, lang,
  })
  return bytesToBase64(bytes)
}

async function generatePdfB64(opts: GeneratePdfOpts): Promise<string> {
  const bytes = await buildQuotationPdfBytes(
    tenant,
    quotation,
    texts,
    undefined,    // layoutSections — default
    opts.lang,
    false,        // watermark off
    opts.template,
  )
  return bytesToBase64(bytes)
}

const PDF_RENDER_SCALE = 2.0

async function renderPdfToCanvases(b64: string): Promise<{ pageCount: number }> {
  const container = document.getElementById('pdf-canvases')!
  container.replaceChildren()
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  // pdfjs takes ownership of the buffer — pass a copy so re-renders work.
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  for (let i = 1; i <= doc.numPages; i++) {
    const page     = await doc.getPage(i)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
    const canvas   = document.createElement('canvas')
    canvas.width   = Math.ceil(viewport.width)
    canvas.height  = Math.ceil(viewport.height)
    canvas.setAttribute('data-page', String(i))
    container.appendChild(canvas)
    const ctx = canvas.getContext('2d', { alpha: false })!
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    } as unknown as Parameters<typeof page.render>[0]).promise
  }
  return { pageCount: doc.numPages }
}

window.__testHarness = {
  ready,
  generateXlsxB64,
  generateQuotationDocxB64,
  generateTechSpecDocxB64,
  generatePdfB64,
  renderPdfToCanvases,
}

export {}
