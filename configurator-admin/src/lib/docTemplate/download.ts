// Trigger a browser download for rendered bytes. Mirrors openPdfBlob /
// openDocxBlob / openXlsxBlob in the existing generators.

import type { OutputKind } from './types'

const MIME: Record<OutputKind, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export function downloadBytes(bytes: Uint8Array, kind: OutputKind, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: MIME[kind] })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith(`.${kind}`) ? filename : `${filename}.${kind}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
