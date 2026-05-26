// Starter presets for the template builder. A tenant picks one of these on the
// Templates "Create" form; the chosen preset's block tree is loaded into the
// new template, ready to edit.
//
// - blank     — the generic sample (re-uses makeSampleTemplate so the two stay
//               in one place; also what the render tests exercise).
// - quotation — reproduces the canonical (Modern) quotation content.
// - techspec  — approximates the Technical Specification Word document within
//               the block model (no cover/TOC/page-number primitives).
//
// These are content reproductions, not byte-for-byte copies of the hardcoded
// generators (which remain the untouched default). Every block references only
// valid binding paths from bindings.ts.

import type { DocumentTemplateDefinition, OutputKind } from './types'
import { makeSampleTemplate } from './sampleTemplate'

let _seq = 0
const id = () => `p${Date.now().toString(36)}${(_seq++).toString(36)}`

export function makeBlankTemplate(): DocumentTemplateDefinition {
  return makeSampleTemplate()
}

export function makeQuotationTemplate(): DocumentTemplateDefinition {
  _seq = 0
  return {
    version: 1,
    blocks: [
      { id: id(), kind: 'image', source: 'tenant_logo', maxHeight: 40, maxWidth: 160 },
      { id: id(), kind: 'heading', level: 1, content: 'QUOTATION', style: { color: 'accent', weight: 'bold' } },
      { id: id(), kind: 'text', content: '{{quotation.reference_number}}', style: { color: 'muted', size: 'sm' } },
      { id: id(), kind: 'divider' },

      { id: id(), kind: 'heading', level: 3, content: 'Bill to', style: { color: 'muted' } },
      { id: id(), kind: 'key-value', rows: [
        { label: 'Customer', value: 'quotation.customer_name' },
        { label: 'Company',  value: 'quotation.customer_company' },
        { label: 'Email',    value: 'quotation.customer_email' },
        { label: 'Address',  value: 'quotation.customer_address' },
      ] },

      { id: id(), kind: 'heading', level: 3, content: 'Quote details', style: { color: 'muted' } },
      { id: id(), kind: 'key-value', rows: [
        { label: 'Reference',   value: 'quotation.reference_number' },
        { label: 'Issue date',  value: 'quotation.created_at' },
        { label: 'Valid until', value: 'quotation.valid_until' },
        { label: 'Currency',    value: 'quotation.currency' },
      ] },

      { id: id(), kind: 'spacer', height: 8 },
      { id: id(), kind: 'heading', level: 3, content: 'Line items', style: { color: 'muted' } },
      { id: id(), kind: 'line-items-table', showSummary: true, columns: [
        { header: 'Product',    value: 'line_item.product_name' },
        { header: 'Qty',        value: 'line_item.quantity',   align: 'right', width: 0.5 },
        { header: 'Unit price', value: 'line_item.unit_price', align: 'right', width: 0.8 },
        { header: 'Total',      value: 'line_item.line_total', align: 'right', width: 0.8 },
      ] },

      { id: id(), kind: 'spacer', height: 8 },
      { id: id(), kind: 'group',
        visible: { type: 'cmp', field: 'quotation.notes', op: 'not-empty' },
        children: [
          { id: id(), kind: 'heading', level: 3, content: 'Notes' },
          { id: id(), kind: 'text', content: '{{quotation.notes}}' },
        ],
      },
      { id: id(), kind: 'group',
        visible: { type: 'cmp', field: 'quotation.payment_terms', op: 'not-empty' },
        children: [
          { id: id(), kind: 'heading', level: 3, content: 'Payment terms' },
          { id: id(), kind: 'text', content: '{{quotation.payment_terms}}', style: { size: 'sm', color: 'muted' } },
        ],
      },
    ],
  }
}

export function makeTechSpecTemplate(): DocumentTemplateDefinition {
  _seq = 0
  return {
    version: 1,
    // Footer with page numbers on every page, like the hardcoded tech-spec.
    page: { footer: true },
    blocks: [
      // Title block (cover-page content). A page break after it gives the
      // title its own opening page, then chapters start fresh.
      { id: id(), kind: 'spacer', height: 80 },
      { id: id(), kind: 'image', source: 'tenant_logo', maxHeight: 80, maxWidth: 260, style: { align: 'center' } },
      { id: id(), kind: 'heading', level: 1, content: 'Technical Specification', style: { color: 'accent', weight: 'bold', align: 'center' } },
      { id: id(), kind: 'key-value', rows: [
        { label: 'Prepared for', value: 'quotation.customer_name' },
        { label: 'Reference',    value: 'quotation.reference_number' },
        { label: 'Date',         value: 'quotation.created_at' },
      ] },
      { id: id(), kind: 'page-break' },

      // One chapter per product (each starts on its own page), then one
      // sub-section per configuration item. Spec text is justified for a
      // document-grade column.
      { id: id(), kind: 'repeater', over: 'quotation.line_items', pageBreakBefore: true, children: [
        { id: id(), kind: 'heading', level: 1, content: '{{line_item.product_name}}', style: { weight: 'bold' } },
        { id: id(), kind: 'group',
          visible: { type: 'cmp', field: 'line_item.specification', op: 'not-empty' },
          children: [
            { id: id(), kind: 'text', content: '{{line_item.specification}}', style: { align: 'justify' } },
          ],
        },
        { id: id(), kind: 'image', source: 'binding', binding: 'line_item.product_image', maxWidth: 420, maxHeight: 300 },

        { id: id(), kind: 'repeater', over: 'line_item.configuration', children: [
          { id: id(), kind: 'heading', level: 2,
            content: '{{config_item.characteristic_name}}: {{config_item.value_label}}' },
          { id: id(), kind: 'group',
            visible: { type: 'cmp', field: 'config_item.specification', op: 'not-empty' },
            children: [
              { id: id(), kind: 'text', content: '{{config_item.specification}}', style: { align: 'justify' } },
            ],
          },
          { id: id(), kind: 'image', source: 'binding', binding: 'config_item.value_image', maxWidth: 320, maxHeight: 220 },
        ] },
        { id: id(), kind: 'spacer', height: 10 },
      ] },
    ],
  }
}

export interface TemplatePreset {
  id:     string
  label:  { en: string; sr: string }
  /** Default output kind suggested when this preset is chosen. */
  output: OutputKind
  make:   () => DocumentTemplateDefinition
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: 'blank',     label: { en: 'Blank',                     sr: 'Prazno' },                  output: 'pdf',  make: makeBlankTemplate },
  { id: 'quotation', label: { en: 'Quotation',                 sr: 'Ponuda' },                  output: 'pdf',  make: makeQuotationTemplate },
  { id: 'techspec',  label: { en: 'Technical specification',   sr: 'Tehnička specifikacija' },  output: 'docx', make: makeTechSpecTemplate },
]

export function presetById(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find(p => p.id === id)
}
