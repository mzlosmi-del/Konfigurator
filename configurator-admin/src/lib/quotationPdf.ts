import type { Quotation, ProductText } from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import { renderModern }  from './pdf/templateModern'
import { renderClassic } from './pdf/templateClassic'
import { renderCompact } from './pdf/templateCompact'
import { renderBold }    from './pdf/templateBold'
import type { PdfTemplate, TenantProfile } from './pdf/shared'

export type { TenantProfile, PdfTemplate } from './pdf/shared'

export const PDF_TEMPLATES: { id: PdfTemplate; label: string; description: string }[] = [
  { id: 'modern',  label: 'Modern',  description: 'Minimal light palette. Hierarchy from typography and thin rules.' },
  { id: 'classic', label: 'Classic', description: 'Traditional corporate. Dark navy header band, boxed sender/customer panels.' },
  { id: 'compact', label: 'Compact', description: 'Dense single-page-friendly. Tight margins and smaller type for short quotes.' },
  { id: 'bold',    label: 'Bold',    description: 'Brand-forward. Vertical accent bar, oversized hero title, accent totals.' },
]

export async function buildQuotationPdfBytes(
  tenant: TenantProfile,
  quotation: Quotation,
  productTexts?: Record<string, ProductText[]>,
  globalTexts?: ProductText[],
  layoutSections?: PdfSection[],
  lang: 'en' | 'sr' = 'en',
  watermark?: boolean,
  template: PdfTemplate = 'modern',
): Promise<Uint8Array> {
  const args = { tenant, quotation, productTexts, globalTexts, layoutSections, lang, watermark, template }
  switch (template) {
    case 'classic': return renderClassic(args)
    case 'compact': return renderCompact(args)
    case 'bold':    return renderBold(args)
    case 'modern':
    default:        return renderModern(args)
  }
}

export function openPdfBlob(bytes: Uint8Array) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
}
