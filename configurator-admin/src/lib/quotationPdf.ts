import type { Quotation, TenantText } from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import { renderModern }  from './pdf/templateModern'
import { renderClassic } from './pdf/templateClassic'
import { renderCompact } from './pdf/templateCompact'
import { renderBold }    from './pdf/templateBold'
import type { PdfTemplate, TenantProfile } from './pdf/shared'

export type { TenantProfile, PdfTemplate } from './pdf/shared'

export const PDF_TEMPLATES: { id: PdfTemplate; label: string; description: string }[] = [
  { id: 'modern',  label: 'Modern',  description: 'Minimal light palette. Hierarchy from typography and thin rules.' },
  { id: 'classic', label: 'Classic', description: 'Traditional invoice look. Navy accents, filled table header, navy total bar.' },
  { id: 'compact', label: 'Compact', description: 'Same content as Modern, tighter margins and smaller type. Fits short quotes on one page.' },
  { id: 'bold',    label: 'Bold',    description: 'Editorial style. Left accent stripe, coral section labels, accent total band.' },
]

export async function buildQuotationPdfBytes(
  tenant: TenantProfile,
  quotation: Quotation,
  /** Pre-fetched `tenant_texts` rows scoped to the tenant plus every product
   *  referenced by this quotation. Use `fetchQuotationTexts` in `lib/texts.ts`. */
  texts: TenantText[] = [],
  layoutSections?: PdfSection[],
  lang: 'en' | 'sr' = 'en',
  watermark?: boolean,
  template: PdfTemplate = 'modern',
): Promise<Uint8Array> {
  const args = { tenant, quotation, texts, layoutSections, lang, watermark, template }
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
