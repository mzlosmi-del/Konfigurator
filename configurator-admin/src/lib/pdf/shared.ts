import { PDFDocument, PDFFont, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Quotation, TenantText } from '@/types/database'
import type { PdfSection } from '@/pages/quotations/PdfLayoutDialog'
import type { OutputLang } from '@/lib/languages'

/** Language fallback order for resolving per-tenant output text.
 *  chosen → EN → SR (deduped). Callers append the canonical name/value last. */
export function outputLangFallback(lang: OutputLang): OutputLang[] {
  if (lang === 'en') return ['en', 'sr']
  if (lang === 'sr') return ['sr', 'en']
  return [lang, 'en', 'sr']
}

/** Pick a value from a per-language map, following the output fallback chain,
 *  finally returning `map.en` (or undefined) when nothing matches. */
export function pickByLang<T>(lang: OutputLang, map: Partial<Record<OutputLang, T>>): T | undefined {
  for (const l of outputLangFallback(lang)) {
    const v = map[l]
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) return v
  }
  return map.en
}

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
  lang: OutputLang,
): string {
  if (texts && texts.length > 0) {
    const footerRows = texts.filter(r => r.level === 'tenant' && r.reference_id === null && r.slot === 'pdf_footer')
    // Resolve chosen → EN → SR; fall back to any authored footer row otherwise.
    for (const l of outputLangFallback(lang)) {
      const row = footerRows.find(r => r.language === l && r.content.trim())
      if (row) return row.content.trim()
    }
    const any = footerRows.find(r => r.content.trim())
    if (any) return any.content.trim()
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
  lang: OutputLang,
): readonly string[] {
  if (!texts || texts.length === 0) return fallback
  const linesFor = (l: OutputLang) => texts
    .filter(r => r.level === 'tenant' && r.reference_id === null && r.slot === 'terms_line' && r.language === l)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => r.content)
    .filter(s => s.trim().length > 0)
  // Use the first language in the fallback chain that has any authored lines.
  for (const l of outputLangFallback(lang)) {
    const rows = linesFor(l)
    if (rows.length > 0) return rows
  }
  return fallback
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
  lang:             OutputLang
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
// `en` is the canonical shape; every other language must define the same keys.
// Adding a new output language: add its code to OUTPUT_LANGS (lib/languages.ts)
// and a full entry here — the `Record<OutputLang, LabelSet>` typing makes the
// compiler reject any missing key.

const EN_LABELS = {
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
  from:         'FROM',
  to:           'TO',
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
  dateLocale:   'en-GB',
  previewWatermark: 'PREVIEW — Not an official quotation',
  previewSectionsHint: 'Configurable sections — drag in left panel to reorder',
}

export type LabelSet = typeof EN_LABELS

export const PDF_LABELS: Record<OutputLang, LabelSet> = {
  en: EN_LABELS,
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
    from:         'OD',
    to:           'ZA',
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
    dateLocale:   'sr-Latn-RS',
    previewWatermark: 'PREGLED — Nije zvanična ponuda',
    previewSectionsHint: 'Sekcije — prevucite u levom panelu za izmenu redosleda',
  },
  de: {
    quotation:    'ANGEBOT',
    billTo:       'RECHNUNGSEMPFÄNGER',
    shipTo:       'LIEFERADRESSE',
    quoteDetails: 'ANGEBOTSDETAILS',
    reference:    'Referenz',
    issued:       'Ausstellungsdatum',
    validUntil:   'Gültig bis',
    currency:     'Währung',
    preparedBy:   'Erstellt von',
    paymentTerms: 'Zahlungsbedingungen',
    vatNumber:    'USt-IdNr.',
    regNumber:    'Reg.-Nr.',
    customerVat:  'USt-IdNr. / Steuernr.',
    lineItems:    'POSITIONEN',
    product:      'PRODUKT',
    qty:          'MENGE',
    uom:          'EINHEIT',
    unitPrice:    'EINZELPREIS',
    total:        'GESAMT',
    basePrice:    'Grundpreis',
    subtotal:     'Zwischensumme',
    totalDue:     'GESAMTBETRAG',
    notes:        'ANMERKUNGEN',
    termsHeader:  'ALLGEMEINE GESCHÄFTSBEDINGUNGEN',
    from:         'VON',
    to:           'AN',
    termsLines: [
      '• Zahlung: 50 % Anzahlung bei Auftragsbestätigung, Restbetrag vor Lieferung fällig.',
      '• Preise verstehen sich ohne Mehrwertsteuer und sonstige anfallende Steuern, sofern nicht anders angegeben.',
      '• Dieses Angebot ist 30 Tage ab Ausstellungsdatum gültig, sofern oben kein abweichendes Ablaufdatum angegeben ist.',
      '• Die Ware bleibt bis zur vollständigen Bezahlung Eigentum des Verkäufers.',
      '• Lieferzeiten sind Richtwerte und werden bei Auftragserteilung schriftlich bestätigt.',
      '• Änderungen am vereinbarten Auftrag müssen schriftlich beantragt und bestätigt werden.',
      '• Der Verkäufer haftet nicht für Verzögerungen aufgrund von Umständen außerhalb seiner zumutbaren Kontrolle.',
      '• Vielen Dank für Ihr Vertrauen. Wir freuen uns auf die Zusammenarbeit.',
    ],
    validityText: (date: string) => `Gültig bis ${date}`,
    contactText:  'Kontaktieren Sie uns, um Ihre Bestellung zu bestätigen.',
    footer:       'Configureout',
    page:         'Seite',
    of:           'von',
    dateLocale:   'de-DE',
    previewWatermark: 'VORSCHAU — Kein offizielles Angebot',
    previewSectionsHint: 'Konfigurierbare Abschnitte — im linken Bereich zum Umsortieren ziehen',
  },
  fr: {
    quotation:    'DEVIS',
    billTo:       'FACTURÉ À',
    shipTo:       'LIVRÉ À',
    quoteDetails: 'DÉTAILS DU DEVIS',
    reference:    'Référence',
    issued:       'Date d’émission',
    validUntil:   'Valable jusqu’au',
    currency:     'Devise',
    preparedBy:   'Préparé par',
    paymentTerms: 'Conditions de paiement',
    vatNumber:    'N° TVA',
    regNumber:    'N° d’enreg.',
    customerVat:  'N° TVA / fiscal',
    lineItems:    'LIGNES',
    product:      'PRODUIT',
    qty:          'QTÉ',
    uom:          'UNITÉ',
    unitPrice:    'PRIX UNITAIRE',
    total:        'TOTAL',
    basePrice:    'Prix de base',
    subtotal:     'Sous-total',
    totalDue:     'TOTAL À PAYER',
    notes:        'NOTES',
    termsHeader:  'CONDITIONS GÉNÉRALES',
    from:         'DE',
    to:           'À',
    termsLines: [
      '• Paiement : acompte de 50 % à la confirmation de commande, solde dû avant la livraison.',
      '• Les prix s’entendent hors TVA et toutes taxes applicables, sauf indication contraire.',
      '• Ce devis est valable 30 jours à compter de la date d’émission, sauf date d’expiration précisée ci-dessus.',
      '• Les marchandises restent la propriété du vendeur jusqu’au paiement intégral.',
      '• Les délais de livraison sont indicatifs et seront confirmés par écrit à la passation de la commande.',
      '• Toute modification de la commande convenue doit être demandée et confirmée par écrit.',
      '• Le vendeur ne saurait être tenu responsable des retards dus à des circonstances échappant à son contrôle raisonnable.',
      '• Merci de votre confiance. Nous nous réjouissons de collaborer avec vous.',
    ],
    validityText: (date: string) => `Valable jusqu’au ${date}`,
    contactText:  'Contactez-nous pour confirmer votre commande.',
    footer:       'Configureout',
    page:         'Page',
    of:           'sur',
    dateLocale:   'fr-FR',
    previewWatermark: 'APERÇU — Devis non officiel',
    previewSectionsHint: 'Sections configurables — glissez dans le panneau de gauche pour réordonner',
  },
  es: {
    quotation:    'PRESUPUESTO',
    billTo:       'FACTURAR A',
    shipTo:       'ENVIAR A',
    quoteDetails: 'DETALLES DEL PRESUPUESTO',
    reference:    'Referencia',
    issued:       'Fecha de emisión',
    validUntil:   'Válido hasta',
    currency:     'Moneda',
    preparedBy:   'Preparado por',
    paymentTerms: 'Condiciones de pago',
    vatNumber:    'N.º de IVA',
    regNumber:    'N.º de reg.',
    customerVat:  'N.º de IVA / fiscal',
    lineItems:    'LÍNEAS',
    product:      'PRODUCTO',
    qty:          'CANT.',
    uom:          'UD.',
    unitPrice:    'PRECIO UNITARIO',
    total:        'TOTAL',
    basePrice:    'Precio base',
    subtotal:     'Subtotal',
    totalDue:     'TOTAL A PAGAR',
    notes:        'NOTAS',
    termsHeader:  'TÉRMINOS Y CONDICIONES',
    from:         'DE',
    to:           'PARA',
    termsLines: [
      '• Pago: 50 % de anticipo a la confirmación del pedido, saldo restante antes de la entrega.',
      '• Los precios no incluyen el IVA ni otros impuestos aplicables, salvo que se indique lo contrario.',
      '• Este presupuesto es válido durante 30 días desde la fecha de emisión, salvo que se indique arriba una fecha de vencimiento concreta.',
      '• La mercancía sigue siendo propiedad del vendedor hasta el pago íntegro.',
      '• Los plazos de entrega son orientativos y se confirmarán por escrito al realizar el pedido.',
      '• Cualquier modificación del pedido acordado debe solicitarse y confirmarse por escrito.',
      '• El vendedor no será responsable de retrasos causados por circunstancias ajenas a su control razonable.',
      '• Gracias por su confianza. Esperamos poder trabajar con usted.',
    ],
    validityText: (date: string) => `Válido hasta ${date}`,
    contactText:  'Contáctenos para confirmar su pedido.',
    footer:       'Configureout',
    page:         'Página',
    of:           'de',
    dateLocale:   'es-ES',
    previewWatermark: 'VISTA PREVIA — No es un presupuesto oficial',
    previewSectionsHint: 'Secciones configurables — arrastre en el panel izquierdo para reordenar',
  },
  ru: {
    quotation:    'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ',
    billTo:       'ПЛАТЕЛЬЩИК',
    shipTo:       'АДРЕС ДОСТАВКИ',
    quoteDetails: 'ДЕТАЛИ ПРЕДЛОЖЕНИЯ',
    reference:    'Номер',
    issued:       'Дата выставления',
    validUntil:   'Действительно до',
    currency:     'Валюта',
    preparedBy:   'Подготовил',
    paymentTerms: 'Условия оплаты',
    vatNumber:    'ИНН / НДС',
    regNumber:    'Рег. №',
    customerVat:  'ИНН / НДС',
    lineItems:    'ПОЗИЦИИ',
    product:      'ТОВАР',
    qty:          'КОЛ-ВО',
    uom:          'ЕД.',
    unitPrice:    'ЦЕНА ЗА ЕД.',
    total:        'ИТОГО',
    basePrice:    'Базовая цена',
    subtotal:     'Промежуточный итог',
    totalDue:     'ИТОГО К ОПЛАТЕ',
    notes:        'ПРИМЕЧАНИЯ',
    termsHeader:  'УСЛОВИЯ',
    from:         'ОТ',
    to:           'КОМУ',
    termsLines: [
      '• Оплата: 50 % предоплаты при подтверждении заказа, остаток — до поставки.',
      '• Цены указаны без НДС и иных применимых налогов, если не указано иное.',
      '• Настоящее предложение действительно в течение 30 дней с даты выставления, если выше не указан конкретный срок.',
      '• Товар остаётся собственностью продавца до полной оплаты.',
      '• Сроки поставки являются ориентировочными и подтверждаются письменно при размещении заказа.',
      '• Любые изменения согласованного заказа должны запрашиваться и подтверждаться в письменной форме.',
      '• Продавец не несёт ответственности за задержки, вызванные обстоятельствами вне его разумного контроля.',
      '• Благодарим за сотрудничество. Будем рады работать с вами.',
    ],
    validityText: (date: string) => `Действительно до ${date}`,
    contactText:  'Свяжитесь с нами для подтверждения заказа.',
    footer:       'Configureout',
    page:         'Стр.',
    of:           'из',
    dateLocale:   'ru-RU',
    previewWatermark: 'ПРЕДПРОСМОТР — не является официальным предложением',
    previewSectionsHint: 'Настраиваемые разделы — перетащите на левой панели для изменения порядка',
  },
}

/** Safe accessor — returns the label set for `lang`, falling back to English. */
export function labelsFor(lang: OutputLang): LabelSet {
  return PDF_LABELS[lang] ?? PDF_LABELS.en
}

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
  if (!logoUrl) {
    console.warn('[loadLogoBytes] no logo URL set on the tenant; cover will fall back to the tenant name')
    return null
  }
  let res: Response
  try {
    res = await fetch(logoUrl)
  } catch (err) {
    console.warn('[loadLogoBytes] fetch threw — likely CORS or network error', { logoUrl, err })
    return null
  }
  if (!res.ok) {
    console.warn('[loadLogoBytes] fetch returned non-OK', { logoUrl, status: res.status, statusText: res.statusText })
    return null
  }
  try {
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

    if (bytes.length === 0) {
      console.warn('[loadLogoBytes] fetched URL returned 0 bytes', { logoUrl })
      return null
    }
    return { bytes, extension, width, height }
  } catch (err) {
    console.warn('[loadLogoBytes] decode failed', { logoUrl, err })
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
  lang: OutputLang,
): string {
  if (!i18n) return ''
  for (const l of outputLangFallback(lang)) {
    const v = i18n[l]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export function buildOrderedSections(
  layoutSections: PdfSection[] | undefined,
  /** Tenant-level text rows in the chosen language; produces one section per row. */
  globalTextRows: { id: string; label: string | null }[] | undefined,
  _lang: OutputLang,
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
