import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Lock, Eye, EyeOff, FileText, FileSpreadsheet, FileType2 } from 'lucide-react'
import type { Quotation, QuotationLineItem, QuotationAdjustment } from '@/types/database'

/** Minimal text-block shape needed by the dialog: an id (used as section key
 *  in the URL), a heading label, and the body content shown in the preview.
 *  Caller derives these from `tenant_texts` rows for the chosen language. */
export interface PdfTextBlock {
  id:      string
  label:   string
  content: string
}
import { type TenantProfile, type PdfTemplate, PDF_TEMPLATES } from '@/lib/quotationPdf'

export type ExportFormat = 'pdf' | 'docx' | 'xlsx'
import { calcLineTotal, calcSubtotal, calcTotal } from '@/lib/quotations'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { OUTPUT_LANGS, type OutputLang, getLanguageName, asOutputLang } from '@/lib/languages'
import { labelsFor } from '@/lib/pdf/shared'

export interface PdfSection {
  id:            string
  label:         string
  visible:       boolean
  locked?:       boolean
  textId?:       string   // global text block ID
  productTextId?: string  // product text entry ID
  productId?:    string   // owning product (for productTextId sections)
  group?:        string   // display group label shown below the section title
}

export interface ProductTextGroup {
  productId:   string
  productName: string
  texts:       PdfTextBlock[]
}

interface Props {
  open:              boolean
  onOpenChange:      (open: boolean) => void
  globalTexts:       PdfTextBlock[]
  productTexts?:     ProductTextGroup[]
  quotationHasNotes: boolean
  onConfirm:         (sections: PdfSection[], lang: OutputLang, template: PdfTemplate, format: ExportFormat) => void
  loading:           boolean
  quotation:         Quotation
  tenant:            TenantProfile
  /** Output language to preselect when the dialog opens (defaults to 'en').
   *  Pass the quotation's saved `lang` so re-opening preserves the choice. */
  defaultLang?:      OutputLang
  /** When true, only PDF can be generated (used by the confirm-quotation flow,
   *  which uploads the file as the official record). */
  pdfOnly?:          boolean
}

// Hex must stay in sync with the accent colours used in each template renderer.
const TEMPLATE_ACCENTS: Record<PdfTemplate, string> = {
  modern:  '#151928',
  classic: '#2A3240',
  compact: '#151928',
  bold:    '#E84A1E',
}

function buildDefaultSections(
  globalTexts: PdfTextBlock[],
  hasNotes: boolean,
  productTexts?: ProductTextGroup[],
): PdfSection[] {
  const sections: PdfSection[] = [
    { id: 'line-items',      label: 'Line Items & Summary', visible: true, locked: true },
    // Operator-toggleable detail-level switch. When off, line items show
    // only product · qty · unit · total — no configuration breakdown or
    // formula lines under each item. Defaults to on (current behaviour).
    { id: 'price-breakdown', label: 'Show price breakdown', visible: true },
    // Opt-in: when on, render the translated characteristic description under each
    // selected option in the line items. Off by default to keep existing PDFs unchanged.
    { id: 'characteristic-descriptions', label: 'Show characteristic descriptions', visible: false },
  ]

  // One toggleable row per product text entry (rendered inline within each line item)
  for (const { productId, productName, texts } of (productTexts ?? [])) {
    for (const pt of texts) {
      sections.push({
        id:            `pt-${pt.id}`,
        label:         pt.label,
        visible:       true,
        productTextId: pt.id,
        productId,
        group:         productName,
      })
    }
  }

  sections.push({ id: 'notes', label: 'Notes', visible: hasNotes })
  sections.push({ id: 'terms', label: 'Terms & Conditions', visible: true })

  for (const txt of globalTexts) {
    sections.push({
      id:      `text-${txt.id}`,
      label:   txt.label,
      visible: true,
      textId:  txt.id,
    })
  }
  return sections
}

// ── Left panel: sortable section row ──────────────────────────────────────────

interface SortableItemProps {
  section:  PdfSection
  onToggle: () => void
}

function SortableItem({ section, onToggle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id:       section.id,
    disabled: section.locked,
  })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 border rounded-lg px-3 py-2',
        section.locked   ? 'bg-muted/30'  : 'bg-background',
        !section.visible ? 'opacity-50'   : '',
      ].join(' ')}
    >
      {section.locked ? (
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{t(section.label)}</span>
        {section.group && (
          <p className="text-xs text-muted-foreground truncate">{section.group}</p>
        )}
      </div>

      {section.locked ? (
        <span className="text-xs text-muted-foreground shrink-0">{t('Always included')}</span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={section.visible ? 'Hide section' : 'Show section'}
        >
          {section.visible
            ? <Eye    className="h-4 w-4 text-primary" />
            : <EyeOff className="h-4 w-4" />
          }
        </button>
      )}
    </div>
  )
}

// ── A4 preview ────────────────────────────────────────────────────────────────

interface PreviewA4Props {
  sections:     PdfSection[]
  quotation:    Quotation
  tenant:       TenantProfile
  globalTexts:  PdfTextBlock[]
  productTexts: ProductTextGroup[]
  lang:         OutputLang
  template:     PdfTemplate
  onToggle:     (id: string) => void
}

function PreviewA4({ sections, quotation, tenant, globalTexts, productTexts, lang, template, onToggle }: PreviewA4Props) {
  const accent = TEMPLATE_ACCENTS[template]
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const subtotal = calcSubtotal(items)
  const total    = calcTotal(subtotal, adjs)
  const cur      = quotation.currency ?? ''
  // Route every fixed label through the shared PDF label set so the live
  // preview matches the generated document for all output languages.
  const L        = labelsFor(lang)

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(L.dateLocale)
  }

  // map textId → content for global text blocks
  const globalTextMap = Object.fromEntries(globalTexts.map(t => [t.id, t]))

  // map productTextId → content for product text blocks
  const productTextMap: Record<string, PdfTextBlock> = {}
  for (const g of productTexts) {
    for (const pt of g.texts) productTextMap[pt.id] = pt
  }

  const configurablesections = sections.filter(s => !s.locked)

  return (
    <div
      className="bg-white shadow-md text-[#151928] font-sans relative"
      style={{ width: 540, minHeight: 762, fontSize: 11 }}
    >
      {/* Template-specific decoration */}
      {template === 'bold' && (
        <div className="absolute top-0 bottom-0 left-0" style={{ width: 6, background: accent }} />
      )}

      {/* Template badge */}
      <div className="absolute top-2 right-2 text-[9px] uppercase tracking-widest font-medium px-1.5 py-0.5 rounded bg-white/90 border z-10"
        style={{ color: accent, borderColor: accent }}>
        {template}
      </div>

      {/* Header */}
      <div className={`flex justify-between items-start ${template === 'bold' ? 'pl-8 pr-8 pt-7 pb-3' : template === 'compact' ? 'px-5 pt-4 pb-2' : 'px-8 pt-7 pb-4'}`}>
        <div style={{ maxWidth: 180 }}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="logo" style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain' }} />
          ) : (
            <span className="font-bold text-base" style={{ color: '#151928' }}>{tenant.name}</span>
          )}
        </div>
        <div className="text-right">
          <div
            className="font-bold tracking-wide"
            style={{
              fontSize: template === 'bold' ? 22 : template === 'compact' ? 16 : 22,
              color: accent,
            }}
          >
            {L.quotation}
          </div>
          {quotation.reference_number && (
            <div className="text-xs mt-0.5 text-[#6C7179]">{quotation.reference_number}</div>
          )}
          {quotation.title && (
            <div className="text-xs font-medium mt-0.5 text-[#151928]">{quotation.title}</div>
          )}
          <div className="text-xs mt-0.5 text-[#6C7179]">
            {L.issued}: {fmtDate(quotation.created_at)}
          </div>
          {quotation.valid_until && (
            <div className="text-xs text-[#6C7179]">
              {L.validUntil}: {fmtDate(quotation.valid_until)}
            </div>
          )}
        </div>
      </div>
      {/* Header rule — accent colour for Classic / Bold to hint at the template */}
      <div
        className="mx-8 border-t"
        style={{
          borderColor: template === 'classic' || template === 'bold' ? accent : '#D2D4D8',
          borderTopWidth: template === 'classic' ? 1.5 : template === 'bold' ? 1 : 1,
        }}
      />

      {/* Sender strip */}
      <div className="mx-8 mt-3 mb-1 bg-[#F4F5F7] rounded px-3 py-2 text-xs text-[#6C7179] flex flex-wrap gap-x-4 gap-y-0.5">
        <span className="font-semibold text-[#151928]">{tenant.name}</span>
        {tenant.contact_person && <span>{tenant.contact_person}</span>}
        {tenant.company_address && <span>{tenant.company_address}</span>}
        {tenant.company_phone   && <span>{tenant.company_phone}</span>}
        {tenant.company_email   && <span>{tenant.company_email}</span>}
        {tenant.vat_number      && <span>{L.vatNumber} {tenant.vat_number}</span>}
        {tenant.company_reg_number && <span>{L.regNumber} {tenant.company_reg_number}</span>}
      </div>
      <div className="mx-8 mt-2 border-t border-[#D2D4D8]" />

      {/* Bill To / Quote Details */}
      <div className="mx-8 mt-3 mb-1 grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-bold text-[10px] text-[#6C7179] tracking-widest mb-1">
            {L.billTo}
          </div>
          {quotation.customer_name    && <div className="font-semibold text-[#151928]">{quotation.customer_name}</div>}
          {quotation.customer_company && <div className="text-[#6C7179]">{quotation.customer_company}</div>}
          {quotation.customer_address && <div className="text-[#6C7179] whitespace-pre-line">{quotation.customer_address}</div>}
          {quotation.customer_email   && <div className="text-[#154BE4]">{quotation.customer_email}</div>}
          {quotation.customer_phone   && <div className="text-[#6C7179]">{quotation.customer_phone}</div>}
        </div>
        <div>
          <div className="font-bold text-[10px] text-[#6C7179] tracking-widest mb-1">
            {L.quoteDetails}
          </div>
          <div className="space-y-0.5 text-[#6C7179]">
            {quotation.reference_number && (
              <div><span className="font-medium text-[#151928]">{L.reference}:</span> {quotation.reference_number}</div>
            )}
            <div><span className="font-medium text-[#151928]">{L.issued}:</span> {fmtDate(quotation.created_at)}</div>
            {quotation.valid_until && (
              <div><span className="font-medium text-[#151928]">{L.validUntil}:</span> {fmtDate(quotation.valid_until)}</div>
            )}
            {cur && (
              <div><span className="font-medium text-[#151928]">{L.currency}:</span> {cur}</div>
            )}
            {(quotation as { payment_terms?: string | null }).payment_terms && (
              <div><span className="font-medium text-[#151928]">{L.paymentTerms}:</span> {(quotation as { payment_terms?: string | null }).payment_terms}</div>
            )}
          </div>
        </div>
      </div>
      <div className="mx-8 mt-3 border-t border-[#D2D4D8]" />

      {/* Line Items */}
      <div className="mx-8 mt-3">
        <div className="font-bold text-[10px] text-[#6C7179] tracking-widest mb-1.5">
          {L.lineItems}
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#D2D4D8]">
              <th className="text-left py-1 text-[#6C7179] font-semibold w-5">#</th>
              <th className="text-left py-1 text-[#6C7179] font-semibold">{L.product}</th>
              <th className="text-right py-1 text-[#6C7179] font-semibold w-8">{L.qty}</th>
              <th className="text-right py-1 text-[#6C7179] font-semibold w-20">{L.unitPrice}</th>
              <th className="text-right py-1 text-[#6C7179] font-semibold w-20">{L.total}</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 4).map((item, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-[#F7F8FB]' : ''}>
                <td className="py-1.5 text-[#6C7179]">{i + 1}</td>
                <td className="py-1.5 text-[#151928] font-medium pr-2">{item.product_name}</td>
                <td className="py-1.5 text-right text-[#151928] tabular-nums">{item.quantity}</td>
                <td className="py-1.5 text-right text-[#151928] tabular-nums">
                  {item.unit_price.toFixed(2)} {cur}
                </td>
                <td className="py-1.5 text-right text-[#151928] font-semibold tabular-nums">
                  {calcLineTotal(item).toFixed(2)} {cur}
                </td>
              </tr>
            ))}
            {items.length > 4 && (
              <tr>
                <td colSpan={5} className="py-1.5 text-[#6C7179] italic text-center">
                  …and {items.length - 4} more
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Price summary */}
        <div className="mt-2 border-t border-[#D2D4D8] pt-2 flex flex-col items-end gap-0.5">
          <div className="flex gap-6 text-xs text-[#6C7179]">
            <span>{L.subtotal}</span>
            <span className="tabular-nums w-24 text-right">{subtotal.toFixed(2)} {cur}</span>
          </div>
          {adjs.map((adj, i) => {
            const running = calcTotal(subtotal, adjs.slice(0, i))
            const amount  = adj.mode === 'percent' ? (running * adj.value) / 100 : adj.value
            const applied = adj.type === 'discount' ? -amount : amount
            return (
              <div key={i} className="flex gap-6 text-xs text-[#6C7179]">
                <span>{adj.label}</span>
                <span className={`tabular-nums w-24 text-right ${applied < 0 ? 'text-[#D22E2E]' : 'text-[#0C9563]'}`}>
                  {applied >= 0 ? '+' : ''}{applied.toFixed(2)} {cur}
                </span>
              </div>
            )
          })}
          <div
            className={`flex gap-6 font-bold pt-1 mt-0.5 ${template === 'bold' ? 'rounded px-2 py-1' : 'border-t border-[#D2D4D8]'}`}
            style={{
              fontSize: template === 'bold' ? 14 : 12,
              background: template === 'bold' ? `${accent}15` : undefined,
              borderLeft: template === 'bold' ? `3px solid ${accent}` : undefined,
            }}
          >
            <span style={{ color: accent }}>{L.totalDue}</span>
            <span className="tabular-nums w-24 text-right" style={{ color: accent }}>{total.toFixed(2)} {cur}</span>
          </div>
        </div>
      </div>

      {/* Configurable sections */}
      {configurablesections.length > 0 && (
        <div className="mx-8 mt-3 space-y-2 pb-6">
          <div className="border-t border-dashed border-[#D2D4D8] pt-2 mb-1">
            <span className="text-[9px] text-[#ADB1B7] uppercase tracking-widest">
              {L.previewSectionsHint}
            </span>
          </div>
          {configurablesections.map(section => {
            let preview = ''
            if (section.id === 'notes') {
              preview = String(quotation.notes ?? '').slice(0, 150)
            } else if (section.id === 'terms') {
              preview = L.termsLines.slice(0, 3).join('  ')
            } else if (section.textId) {
              const txt = globalTextMap[section.textId]
              preview = txt ? String(txt.content ?? '').slice(0, 150) : ''
            } else if (section.productTextId) {
              const pt = productTextMap[section.productTextId]
              preview = pt ? String(pt.content ?? '').slice(0, 150) : ''
            }

            return (
              <div
                key={section.id}
                className={[
                  'border rounded-lg px-3 py-2 transition-opacity',
                  !section.visible ? 'opacity-40' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={[
                      'text-xs font-semibold text-[#151928]',
                      !section.visible ? 'line-through text-[#6C7179]' : '',
                    ].join(' ')}
                  >
                    {t(section.label)}
                    {section.group && (
                      <span className="font-normal text-[#6C7179] ml-1">({section.group})</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggle(section.id)}
                    className="text-[#6C7179] hover:text-[#151928] shrink-0"
                    aria-label={section.visible ? 'Hide section' : 'Show section'}
                  >
                    {section.visible
                      ? <Eye    className="h-3.5 w-3.5 text-primary" />
                      : <EyeOff className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
                {preview && (
                  <p className="text-[10px] text-[#6C7179] leading-relaxed line-clamp-2">
                    {preview}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function PdfLayoutDialog({
  open, onOpenChange, globalTexts, productTexts, quotationHasNotes,
  onConfirm, loading, quotation, tenant, pdfOnly, defaultLang = 'en',
}: Props) {
  const [sections, setSections] = useState<PdfSection[]>(() =>
    buildDefaultSections(globalTexts, quotationHasNotes, productTexts)
  )
  const [lang, setLang] = useState<OutputLang>(defaultLang)
  const [template, setTemplate] = useState<PdfTemplate>('modern')
  const [format, setFormat] = useState<ExportFormat>('pdf')

  // Reset when dialog opens
  const [lastOpen, setLastOpen] = useState(false)
  if (open && !lastOpen) {
    setSections(buildDefaultSections(globalTexts, quotationHasNotes, productTexts))
    setLang(defaultLang)
    setTemplate('modern')
    setFormat('pdf')
    setLastOpen(true)
  }
  if (!open && lastOpen) setLastOpen(false)

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id)
      const newIndex = prev.findIndex(s => s.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header bar */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {t('PDF Preview')}
          </DialogTitle>
          {/* Visually-hidden description — Radix expects every Dialog to
              have one for screen readers; the surrounding UI already
              communicates intent visually. */}
          <DialogDescription className="sr-only">
            {t('Reorder, show or hide sections of the quotation PDF and choose the language before generating it.')}
          </DialogDescription>
          {/* Output language picker */}
          <div className="flex items-center gap-2 mr-6">
            <span className="text-xs text-muted-foreground">{t('Language')}:</span>
            <select
              value={lang}
              onChange={e => setLang(asOutputLang(e.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t('Output language')}
            >
              {OUTPUT_LANGS.map(code => (
                <option key={code} value={code}>{t(getLanguageName(code))}</option>
              ))}
            </select>
          </div>
        </DialogHeader>

        {/* Body: left controls + right preview */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — template + section controls */}
          <div className="w-64 shrink-0 border-r flex flex-col">
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
              {/* Template selector — disabled for DOCX/XLSX, which always use
                  the canonical layout (mirrors the Modern PDF). */}
              <div className={format === 'pdf' ? '' : 'opacity-50 pointer-events-none'}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('Template')}
                  {format !== 'pdf' && (
                    <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
                      ({t('PDF only')})
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PDF_TEMPLATES.map(tpl => {
                    const accent  = TEMPLATE_ACCENTS[tpl.id]
                    const active  = tpl.id === template
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplate(tpl.id)}
                        disabled={format !== 'pdf'}
                        className={[
                          'border rounded-md px-2 py-2 text-left transition-all hover:bg-muted/50',
                          active ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border',
                        ].join(' ')}
                        title={tpl.description}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ background: accent }}
                          />
                          <span className="text-xs font-medium truncate">{t(tpl.label)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                          {t(tpl.description)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sections */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('Sections')}
                </p>
                <p className="text-xs text-muted-foreground mb-2 leading-tight">
                  {t('Drag to reorder. Toggle eye to show / hide.')}
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {sections.map(section => (
                        <SortableItem
                          key={section.id}
                          section={section}
                          onToggle={() => toggleSection(section.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
            <div className="px-3 py-3 border-t flex flex-col gap-2">
              {!pdfOnly && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {t('Format')}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      { id: 'pdf'  as const, label: 'PDF',  Icon: FileText        },
                      { id: 'docx' as const, label: 'DOCX', Icon: FileType2       },
                      { id: 'xlsx' as const, label: 'XLSX', Icon: FileSpreadsheet },
                    ]).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFormat(id)}
                        className={[
                          'flex items-center justify-center gap-1 border rounded-md px-2 py-1.5 text-xs transition-all',
                          format === id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:bg-muted/50',
                        ].join(' ')}
                        title={
                          id === 'pdf'  ? t('Portable Document Format')
                          : id === 'docx' ? t('Microsoft Word document')
                          : t('Microsoft Excel spreadsheet')
                        }
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full">
                {t('Cancel')}
              </Button>
              <Button onClick={() => onConfirm(sections, lang, template, format)} loading={loading} className="w-full">
                <FileText className="h-4 w-4 mr-1.5" />
                {format === 'pdf'  ? t('Generate PDF')
                 : format === 'docx' ? t('Download DOCX')
                 : t('Download XLSX')}
              </Button>
            </div>
          </div>

          {/* Right panel — A4 preview */}
          <div className="flex-1 overflow-y-auto bg-[#E8E9EC] flex justify-center py-6 px-4">
            <PreviewA4
              sections={sections}
              quotation={quotation}
              tenant={tenant}
              globalTexts={globalTexts}
              productTexts={productTexts ?? []}
              lang={lang}
              template={template}
              onToggle={toggleSection}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
