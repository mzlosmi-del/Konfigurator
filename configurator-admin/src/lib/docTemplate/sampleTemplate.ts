// A built-in sample template definition. Used as:
//   - the default tree when a tenant creates a new template, and
//   - the fixture for the render-without-error tests.
//
// It deliberately exercises every block kind, a repeater over line items, a
// nested repeater over configuration, and a show/hide condition (the notes
// block is hidden when quotation.notes is empty).

import type { DocumentTemplateDefinition } from './types'

let _id = 0
const id = () => `b${++_id}`

export function makeSampleTemplate(): DocumentTemplateDefinition {
  _id = 0
  return {
    version: 1,
    blocks: [
      { id: id(), kind: 'image', source: 'tenant_logo', maxHeight: 40, maxWidth: 160 },
      { id: id(), kind: 'heading', level: 1, content: '{{tenant.name}}', style: { color: 'accent', weight: 'bold' } },
      { id: id(), kind: 'heading', level: 2, content: 'Quotation {{quotation.reference_number}}' },
      { id: id(), kind: 'divider' },

      { id: id(), kind: 'key-value', rows: [
        { label: 'Customer',     value: 'quotation.customer_name' },
        { label: 'Company',      value: 'quotation.customer_company' },
        { label: 'Email',        value: 'quotation.customer_email' },
        { label: 'Valid until',  value: 'quotation.valid_until' },
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
      { id: id(), kind: 'heading', level: 3, content: 'Configuration detail', style: { color: 'muted' } },

      // Nested repeaters: each line item, then each configuration row within it.
      { id: id(), kind: 'repeater', over: 'quotation.line_items', children: [
        { id: id(), kind: 'text', content: '{{line_item.product_name}}', style: { weight: 'bold' } },
        { id: id(), kind: 'repeater', over: 'line_item.configuration', children: [
          { id: id(), kind: 'text', style: { size: 'sm', color: 'muted' },
            content: '  • {{config_item.characteristic_name}}: {{config_item.value_label}}' },
        ] },
      ] },

      { id: id(), kind: 'spacer', height: 8 },

      // Notes block — hidden when there are no notes.
      { id: id(), kind: 'group',
        visible: { type: 'cmp', field: 'quotation.notes', op: 'not-empty' },
        children: [
          { id: id(), kind: 'heading', level: 3, content: 'Notes' },
          { id: id(), kind: 'text', content: '{{quotation.notes}}' },
        ],
      },
    ],
  }
}
