import { PDFDocument, PDFFont, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Quotation, TenantText } from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'

export interface TenantProfile {
  name:                string
  logo_url?:           string | null
  company_address?:    string | null
  company_phone?:      string | null
  company_email?:      string | null
  company_website?:    string | null
  contact_person?:     string | null
  vat_number?:         string | null
  company_reg_number?: string | null
  /** Optional white-label override for the footer attribution. */
  pdf_footer?:         string | null
}

/**
 * Returns the tenant-configured footer when set, else the i18n default.
 * Templates use this in place of `L.footer`. Looks up the `pdf_footer` slot
 * in `tenant_texts`, falling back to the legacy `tenant.pdf_footer` scalar
 * column for now and finally to the i18n default.
 */
export function getFooterLabel(
  tenant: TenantProfile,
  defaultLabel: string,
  texts: TenantText[] | undefined,
  lang: 'en' | 'sr',
): string {
  if (texts && texts.length > 0) {
    const row = texts.find(r => r.level === 'tenant' && r.reference_id === null && r.slot === 'pdf_footer' && r.language === lang)
      ?? texts.find(r => r.level === 'tenant' && r.reference_id === null && r.slot === 'pdf_footer')
    if (row && row.content.trim()) return row.content.trim()
  }
  const legacy = (tenant.pdf_footer ?? '').trim()
  return legacy.length > 0 ? legacy : defaultLabel
}

/** Resolve the configurable Terms & Conditions lines for the current
 *  language. Uses `tenant_texts.terms_line` rows when available, falling
 *  back to the hardcoded `PDF_LABELS.termsLines[lang]`. */
export function getTermsLines(
  texts: TenantText[] | undefined,
  fallback: readonly string[],
  lang: 'en' | 'sr',
): readonly string[] {
  if (!texts || texts.length === 0) return fallback
  const rows = texts
    .filter(r => r.level === 'tenant' && r.reference_id === null && r.slot === 'terms_line' && r.language === lang)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => r.content)
    .filter(s => s.trim().length > 0)
  return rows.length > 0 ? rows : fallback
}

export type PdfTemplate = 'modern' | 'classic' | 'compact' | 'bold'

export interface PdfBuildArgs {
  tenant:           TenantProfile
  quotation:        Quotation
  /** Pre-fetched rows from `tenant_texts`. Renderers resolve text blocks /
   *  terms / footer / per-product texts directly off this array via the
   *  helpers in `lib/texts.ts`. Falls back to an empty array — old quotations
   *  whose tenant never had any texts simply render no blocks. */
  texts?:           TenantText[]
  layoutSections?:  PdfSection[]
  lang:             'en' | 'sr'
  watermark?:       boolean
  template:         PdfTemplate
}

// ── Common palette ─────────────────────────────────────────────────────────────
// Templates may override or extend this palette.
export const C = {
  ink:      rgb(0.082, 0.098, 0.141),
  muted:    rgb(0.424, 0.443, 0.490),
  faint:    rgb(0.678, 0.694, 0.718),
  rowAlt:   rgb(0.969, 0.973, 0.984),
  termsBox: rgb(0.957, 0.961, 0.969),
  rule:     rgb(0.824, 0.831, 0.847),
  accent:   rgb(0.082, 0.298, 0.894),
  positive: rgb(0.047, 0.584, 0.388),
  negative: rgb(0.824, 0.180, 0.180),
  white:    rgb(1, 1, 1),
}

// ── Text wrap ──────────────────────────────────────────────────────────────────
export function wrapText(rawText: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = []
  for (const paragraph of rawText.split(/\r?\n/)) {
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) result.push(line)
        line = word
      } else {
        line = test
      }
    }
    result.push(line)
  }
  return result.length ? result : ['']
}

// ── PDF label translations ────────────────────────────────────────────────────

export const PDF_LABELS = {
  en: {
    quotation:    'QUOTATION',
    billTo:       'BILL TO',
    shipTo:       'SHIP TO',
    quoteDetails: 'QUOTE DETAILS',
    reference:    'Reference',
    issued:       'Issue Date',
    validUntil:   'Valid Until',
    currency:     'Currency',
    preparedBy:   'Prepared By',
    paymentTerms: 'Payment Terms',
    vatNumber:    'VAT No.',
    regNumber:    'Reg. No.',
    customerVat:  'VAT / Tax ID',
    lineItems:    'LINE ITEMS',
    product:      'PRODUCT',
    qty:          'QTY',
    uom:          'UOM',
    unitPrice:    'UNIT PRICE',
    total:        'TOTAL',
    basePrice:    'Base price',
    subtotal:     'Subtotal',
    totalDue:     'TOTAL DUE',
    notes:        'NOTES',
    termsHeader:  'TERMS & CONDITIONS',
    termsLines: [
      '• Payment: 50% deposit on order confirmation, remaining balance due prior to delivery.',
      '• Prices are exclusive of VAT and all applicable taxes unless otherwise stated.',
      '• This quotation is valid for 30 days from the date of issue unless a specific expiry date is noted above.',
      '• Goods remain the property of the seller until full payment has been received.',
      '• Delivery timelines are indicative and will be confirmed in writing upon order placement.',
      '• Any modifications to the agreed order must be requested and confirmed in writing.',
      '• The seller shall not be liable for delays caused by circumstances beyond its reasonable control.',
      '• Thank you for your business. We look forward to working with you.',
    ],
    validityText: (date: string) => `Valid until ${date}`,
    contactText:  'Contact us to confirm your order.',
    footer:       'Configureout',
    page:         'Page',
    of:           'of',
    dateLocale:   'en-GB' as const,
    previewWatermark: 'PREVIEW — Not an official quotation',
  },
  sr: {
    quotation:    'PONUDA',
    billTo:       'NARUČILAC',
    shipTo:       'ADRESA ISPORUKE',
    quoteDetails: 'DETALJI PONUDE',
    reference:    'Referenca',
    issued:       'Datum',
    validUntil:   'Važi do',
    currency:     'Valuta',
    preparedBy:   'Izradio',
    paymentTerms: 'Uslovi plaćanja',
    vatNumber:    'PDV br.',
    regNumber:    'Mat. br.',
    customerVat:  'PIB / PDV br.',
    lineItems:    'STAVKE',
    product:      'PROIZVOD',
    qty:          'KOL.',
    uom:          'JM',
    unitPrice:    'JED. CENA',
    total:        'UKUPNO',
    basePrice:    'Osnovna cena',
    subtotal:     'Međuzbir',
    totalDue:     'UKUPAN IZNOS',
    notes:        'NAPOMENE',
    termsHeader:  'USLOVI I PLAĆANJE',
    termsLines: [
      '• Plaćanje: 50% avansa pri potvrdi porudžbine, preostali iznos dospeva pre isporuke.',
      '• Cene ne uključuju PDV i sve primenjive poreze, osim ako nije drugačije naznačeno.',
      '• Ova ponuda važi 30 dana od datuma izdavanja, osim ako je naznačen konkretan datum važenja.',
      '• Roba ostaje vlasništvo prodavca sve do trenutka potpune naplate.',
      '• Rokovi isporuke su okvirni i biće potvrđeni u pisanoj formi pri prihvatanju porudžbine.',
      '• Svaka izmena dogovorene porudžbine mora biti zatražena i potvrđena u pisanoj formi.',
      '• Prodavac ne snosi odgovornost za kašnjenja nastala usled okolnosti van njegove razumne kontrole.',
      '• Hvala na interesovanju. Radujemo se saradnji.',
    ],
    validityText: (date: string) => `Važi do ${date}`,
    contactText:  'Kontaktirajte nas radi potvrde porudžbine.',
    footer:       'Configureout',
    page:         'Strana',
    of:           'od',
    dateLocale:   'sr-Latn-RS' as const,
    previewWatermark: 'PREGLED — Nije zvanična ponuda',
  },
}

export type LabelSet = typeof PDF_LABELS['en']

// ── Font / image / watermark helpers ──────────────────────────────────────────

export interface LoadedFonts {
  fontR: PDFFont
  fontB: PDFFont
}

export async function loadFonts(pdfDoc: PDFDocument): Promise<LoadedFonts> {
  pdfDoc.registerFontkit(fontkit)
  const [fontRBytes, fontBBytes] = await Promise.all([
    fetch('/fonts/NotoSans-Regular.ttf').then(r => r.arrayBuffer()),
    fetch('/fonts/NotoSans-Bold.ttf').then(r => r.arrayBuffer()),
  ])
  return {
    fontR: await pdfDoc.embedFont(fontRBytes),
    fontB: await pdfDoc.embedFont(fontBBytes),
  }
}

export type EmbeddedImage = Awaited<ReturnType<PDFDocument['embedPng']>>

export async function loadLogo(pdfDoc: PDFDocument, logoUrl: string | null | undefined): Promise<EmbeddedImage | null> {
  if (!logoUrl) return null
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    const ct  = res.headers.get('content-type') ?? ''
    const buf = await res.arrayBuffer()
    return ct.includes('png') || logoUrl.toLowerCase().includes('.png')
      ? await pdfDoc.embedPng(buf)
      : await pdfDoc.embedJpg(buf)
  } catch {
    return null
  }
}

/** Fetches the tenant logo as raw bytes plus a detected extension and natural
 *  pixel dimensions. Used by DOCX/XLSX exporters that don't need a pdf-lib
 *  embedded image. Returns null when no URL is set or the fetch fails. */
export async function loadLogoBytes(logoUrl: string | null | undefined): Promise<
  { bytes: Uint8Array; extension: 'png' | 'jpg' | 'gif' | 'bmp'; width: number; height: number } | null
> {
  if (!logoUrl) return null
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    const ct  = res.headers.get('content-type') ?? ''
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let extension: 'png' | 'jpg' | 'gif' | 'bmp' = 'png'
    if (ct.includes('jpeg') || ct.includes('jpg') || logoUrl.toLowerCase().match(/\.jpe?g(\?|$)/)) extension = 'jpg'
    else if (ct.includes('gif')  || logoUrl.toLowerCase().includes('.gif')) extension = 'gif'
    else if (ct.includes('bmp')  || logoUrl.toLowerCase().includes('.bmp')) extension = 'bmp'

    // Decode natural dimensions in-browser so the consumer can scale to its target box.
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
      const url = URL.createObjectURL(new Blob([buf]))
      const img = new Image()
      img.onload  = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
      img.onerror = () => { resolve({ width: 0, height: 0 });                                 URL.revokeObjectURL(url) }
      img.src = url
    })

    return { bytes, extension, width, height }
  } catch {
    return null
  }
}

export function isSectionVisible(layoutSections: PdfSection[] | undefined, id: string): boolean {
  if (!layoutSections) return true
  const s = layoutSections.find(s => s.id === id)
  return s ? s.visible : true
}

/** Like `isSectionVisible` but defaults to false for legacy callers that don't pass
 *  layoutSections. Use for opt-in additions (e.g. characteristic descriptions). */
export function isSectionVisibleOptIn(layoutSections: PdfSection[] | undefined, id: string): boolean {
  if (!layoutSections) return false
  const s = layoutSections.find(s => s.id === id)
  return !!s && s.visible
}

/** Resolve the description for the current language from a snapshotted
 *  description_i18n map. Returns an empty string when nothing useful is available. */
export function resolveCharDescription(
  i18n: Record<string, string> | null | undefined,
  lang: 'en' | 'sr',
): string {
  if (!i18n) return ''
  const direct = i18n[lang]
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const fallback = lang === 'en' ? i18n.sr : i18n.en
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim()
  return ''
}

export function buildOrderedSections(
  layoutSections: PdfSection[] | undefined,
  /** Tenant-level text rows in the chosen language; produces one section per row. */
  globalTextRows: { id: string; label: string | null }[] | undefined,
  _lang: 'en' | 'sr',
): PdfSection[] {
  const defaultOrder: PdfSection[] = [
    { id: 'notes', label: 'Notes', visible: true },
    { id: 'terms', label: 'Terms & Conditions', visible: true },
    ...(globalTextRows ?? []).map(gt => ({
      id: `text-${gt.id}`, label: gt.label ?? '', visible: true, textId: gt.id,
    })),
  ]
  return layoutSections ? layoutSections.filter(s => !s.locked) : defaultOrder
}
