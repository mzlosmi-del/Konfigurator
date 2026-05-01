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
import { GripVertical, Lock, Eye, EyeOff, FileText } from 'lucide-react'
import type { Quotation, QuotationLineItem, QuotationAdjustment, ProductText } from '@/types/database'
import type { TenantProfile } from '@/lib/quotationPdf'
import { calcLineTotal, calcSubtotal, calcTotal } from '@/lib/quotations'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

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
  texts:       ProductText[]
}

interface Props {
  open:              boolean
  onOpenChange:      (open: boolean) => void
  globalTexts:       ProductText[]
  productTexts?:     ProductTextGroup[]
  quotationHasNotes: boolean
  onConfirm:         (sections: PdfSection[], lang: 'en' | 'sr') => void
  loading:           boolean
  quotation:         Quotation
  tenant:            TenantProfile
}

function buildDefaultSections(
  globalTexts: ProductText[],
  hasNotes: boolean,
  productTexts?: ProductTextGroup[],
): PdfSection[] {
  const sections: PdfSection[] = [
    { id: 'line-items', label: 'Line Items & Summary', visible: true, locked: true },
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

const TERMS_LINES = [
  '• Payment: 50% deposit on order confirmation, balance prior to delivery.',
  '• Prices are exclusive of VAT and applicable taxes unless otherwise stated.',
  '• This quotation is valid for 30 days unless a specific validity date is noted above.',
  '• Delivery timelines will be confirmed upon order placement.',
  '• Thank you for your business.',
]

const TERMS_LINES_SR = [
  '• Plaćanje: 50% avans pri potvrdi porudžbine, ostatak pre isporuke.',
  '• Cene ne uključuju PDV i poreze, osim ako nije drugačije naznačeno.',
  '• Ova ponuda važi 30 dana, osim ako je naznačen konkretan datum.',
  '• Rokovi isporuke biće potvrđeni pri porudžbini.',
  '• Hvala na interesovanju.',
]

interface PreviewA4Props {
  sections:     PdfSection[]
  quotation:    Quotation
  tenant:       TenantProfile
  globalTexts:  ProductText[]
  productTexts: ProductTextGroup[]
  lang:         'en' | 'sr'
  onToggle:     (id: string) => void
}

function PreviewA4({ sections, quotation, tenant, globalTexts, productTexts, lang, onToggle }: PreviewA4Props) {
  const items = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
  const adjs  = (Array.isArray(quotation.adjustments) ? quotation.adjustments : []) as unknown as QuotationAdjustment[]
  const subtotal = calcSubtotal(items)
  const total    = calcTotal(subtotal, adjs)
  const cur      = quotation.currency ?? ''
  const isEn     = lang === 'en'

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(isEn ? 'en-GB' : 'sr-Latn-RS')
  }

  // map textId → content for global text blocks
  const globalTextMap = Object.fromEntries(globalTexts.map(t => [t.id, t]))

  // map productTextId → content for product text blocks
  const productTextMap: Record<string, ProductText> = {}
  for (const g of productTexts) {
    for (const pt of g.texts) productTextMap[pt.id] = pt
  }

  const configurablesections = sections.filter(s => !s.locked)

  return (
    <div
      className="bg-white shadow-md text-[#151928] font-sans"
      style={{ width: 540, minHeight: 762, fontSize: 11 }}
    >
      {/* Header */}
      <div className="px-8 pt-7 pb-4 flex justify-between items-start">
        <div style={{ maxWidth: 180 }}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="logo" style={{ maxHeight: 44, maxWidth: 160, objectFit: 'contain' }} />
          ) : (
            <span className="font-bold text-base text-[#151928]">{tenant.name}</span>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold text-xl tracking-wide text-[#151928]">
            {isEn ? 'QUOTATION' : 'PONUDA'}
          </div>
          {quotation.reference_number && (
            <div className="text-[#6C7179] text-xs mt-0.5">{quotation.reference_number}</div>
          )}
          {quotation.title && (
            <div className="text-[#151928] text-xs font-medium mt-0.5">{quotation.title}</div>
          )}
          <div className="text-[#6C7179] text-xs mt-0.5">
            {isEn ? 'Issue Date' : 'Datum'}: {fmtDate(quotation.created_at)}
          </div>
          {quotation.valid_until && (
            <div className="text-[#6C7179] text-xs">
              {isEn ? 'Valid Until' : 'Važi do'}: {fmtDate(quotation.valid_until)}
            </div>
          )}
        </div>
      </div>
      <div className="mx-8 border-t border-[#D2D4D8]" />

      {/* Sender strip */}
      <div className="mx-8 mt-3 mb-1 bg-[#F4F5F7] rounded px-3 py-2 text-xs text-[#6C7179] flex flex-wrap gap-x-4 gap-y-0.5">
        <span className="font-semibold text-[#151928]">{tenant.name}</span>
        {tenant.contact_person && <span>{tenant.contact_person}</span>}
        {tenant.company_address && <span>{tenant.company_address}</span>}
        {tenant.company_phone   && <span>{tenant.company_phone}</span>}
        {tenant.company_email   && <span>{tenant.company_email}</span>}
        {tenant.vat_number      && <span>{isEn ? 'VAT No.' : 'PDV br.'} {tenant.vat_number}</span>}
        {tenant.company_reg_number && <span>{isEn ? 'Reg. No.' : 'Mat. br.'} {tenant.company_reg_number}</span>}
      </div>
      <div className="mx-8 mt-2 border-t border-[#D2D4D8]" />

      {/* Bill To / Quote Details */}
      <div className="mx-8 mt-3 mb-1 grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-bold text-[10px] text-[#6C7179] tracking-widest mb-1">
            {isEn ? 'BILL TO' : 'NARUČILAC'}
          </div>
          {quotation.customer_name    && <div className="font-semibold text-[#151928]">{quotation.customer_name}</div>}
          {quotation.customer_company && <div className="text-[#6C7179]">{quotation.customer_company}</div>}
          {quotation.customer_address && <div className="text-[#6C7179] whitespace-pre-line">{quotation.customer_address}</div>}
          {quotation.customer_email   && <div className="text-[#154BE4]">{quotation.customer_email}</div>}
          {quotation.customer_phone   && <div className="text-[#6C7179]">{quotation.customer_phone}</div>}
        </div>
        <div>
          <div className="font-bold text-[10px] text-[#6C7179] tracking-widest mb-1">
            {isEn ? 'QUOTE DETAILS' : 'DETALJI PONUDE'}
          </div>
          <div className="space-y-0.5 text-[#6C7179]">
            {quotation.reference_number && (
              <div><span className="font-medium text-[#151928]">{isEn ? 'Reference' : 'Referenca'}:</span> {quotation.reference_number}</div>
            )}
            <div><span className="font-medium text-[#151928]">{isEn ? 'Issue Date' : 'Datum'}:</span> {fmtDate(quotation.created_at)}</div>
            {quotation.valid_until && (
              <div><span className="font-medium text-[#151928]">{isEn ? 'Valid Until' : 'Važi do'}:</span> {fmtDate(quotation.valid_until)}</div>
            )}
            {cur && (
              <div><span className="font-medium text-[#151928]">{isEn ? 'Currency' : 'Valuta'}:</span> {cur}</div>
            )}
            {(quotation as { payment_terms?: string | null }).payment_terms && (
              <div><span className="font-medium text-[#151928]">{isEn ? 'Payment Terms' : 'Uslovi plaćanja'}:</span> {(quotation as { payment_terms?: string | null }).payment_terms}</div>
            )}
          </div>
        </div>
      </div>
      <div className="mx-8 mt-3 border-t border-[#D2D4D8]" />

      {/* Line Items */}
      <div className="mx-8 mt-3">
        <div className="font-bold text-[10px] text-[#6C7179] tracking-widest mb-1.5">
          {isEn ? 'LINE ITEMS' : 'STAVKE'}
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#D2D4D8]">
              <th className="text-left py-1 text-[#6C7179] font-semibold w-5">#</th>
              <th className="text-left py-1 text-[#6C7179] font-semibold">{isEn ? 'PRODUCT' : 'PROIZVOD'}</th>
              <th className="text-right py-1 text-[#6C7179] font-semibold w-8">{isEn ? 'QTY' : 'KOL.'}</th>
              <th className="text-right py-1 text-[#6C7179] font-semibold w-20">{isEn ? 'UNIT PRICE' : 'JED. CENA'}</th>
              <th className="text-right py-1 text-[#6C7179] font-semibold w-20">{isEn ? 'TOTAL' : 'UKUPNO'}</th>
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
            <span>{isEn ? 'Subtotal' : 'Međuzbir'}</span>
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
          <div className="flex gap-6 text-xs font-bold border-t border-[#D2D4D8] pt-1 mt-0.5">
            <span className="text-[#151928]">{isEn ? 'TOTAL DUE' : 'UKUPAN IZNOS'}</span>
            <span className="tabular-nums w-24 text-right text-[#151928]">{total.toFixed(2)} {cur}</span>
          </div>
        </div>
      </div>

      {/* Configurable sections */}
      {configurablesections.length > 0 && (
        <div className="mx-8 mt-3 space-y-2 pb-6">
          <div className="border-t border-dashed border-[#D2D4D8] pt-2 mb-1">
            <span className="text-[9px] text-[#ADB1B7] uppercase tracking-widest">
              {isEn ? 'Configurable sections — drag in left panel to reorder' : 'Sekcije — prevucite u levom panelu za izmenu redosleda'}
            </span>
          </div>
          {configurablesections.map(section => {
            let preview = ''
            if (section.id === 'notes') {
              preview = String(quotation.notes ?? '').slice(0, 150)
            } else if (section.id === 'terms') {
              preview = (isEn ? TERMS_LINES : TERMS_LINES_SR).slice(0, 3).join('  ')
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
                    {section.label}
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
  onConfirm, loading, quotation, tenant,
}: Props) {
  const [sections, setSections] = useState<PdfSection[]>(() =>
    buildDefaultSections(globalTexts, quotationHasNotes, productTexts)
  )
  const [lang, setLang] = useState<'en' | 'sr'>('en')

  // Reset when dialog opens
  const [lastOpen, setLastOpen] = useState(false)
  if (open && !lastOpen) {
    setSections(buildDefaultSections(globalTexts, quotationHasNotes, productTexts))
    setLang('en')
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
          {/* Language toggle */}
          <div className="flex items-center gap-2 mr-6">
            <span className="text-xs text-muted-foreground">{t('Language')}:</span>
            <div className="flex rounded-md border overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 transition-colors ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'}`}
              >
                {t('English')}
              </button>
              <button
                type="button"
                onClick={() => setLang('sr')}
                className={`px-3 py-1 transition-colors border-l ${lang === 'sr' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'}`}
              >
                {t('Serbian')}
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Body: left controls + right preview */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — section controls */}
          <div className="w-56 shrink-0 border-r flex flex-col">
            <div className="flex-1 overflow-y-auto px-3 py-3">
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
            <div className="px-3 py-3 border-t flex flex-col gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full">
                {t('Cancel')}
              </Button>
              <Button onClick={() => onConfirm(sections, lang)} loading={loading} className="w-full">
                <FileText className="h-4 w-4 mr-1.5" />
                {t('Generate PDF')}
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
              onToggle={toggleSection}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
