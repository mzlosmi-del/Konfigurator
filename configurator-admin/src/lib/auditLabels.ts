// Maps DB column names to human-readable labels (English source — translated
// at render time via t()). Only fields present in these maps are tracked by
// the audit log helper; everything else (ids, *_at, tenant_id) is ignored.

export const PRODUCT_LABELS: Record<string, string> = {
  name:            'Name',
  sku:             'SKU',
  description:     'Description',
  base_price:      'Base price',
  unit_of_measure: 'Unit of measure',
  published:       'Published',
  currency:        'Currency',
  show_price_breakdown: 'Show price breakdown',
}

export const CHARACTERISTIC_LABELS: Record<string, string> = {
  name:         'Name',
  display_type: 'Display type',
  required:     'Required',
  sort_order:   'Sort order',
}

export const CHARACTERISTIC_VALUE_LABELS: Record<string, string> = {
  label:          'Label',
  price_modifier: 'Price modifier',
  sort_order:     'Sort order',
}

export const CLASS_LABELS: Record<string, string> = {
  name: 'Name',
}

export const PRICING_SCHEDULE_LABELS: Record<string, string> = {
  base_price: 'Base price',
  starts_on:  'Starts on',
  ends_on:    'Ends on',
}

export const PRICING_FORMULA_LABELS: Record<string, string> = {
  name:    'Name',
  formula: 'Formula',
}

export const PRODUCT_TEXT_LABELS: Record<string, string> = {
  type:    'Type',
  title:   'Title',
  content: 'Content',
}

export const GLOBAL_TEXT_LABELS: Record<string, string> = {
  key:     'Key',
  content: 'Content',
}

export const SETTINGS_LABELS: Record<string, string> = {
  // tenant settings — most everything except ids
  name:                  'Workspace name',
  contact_email:         'Contact email',
  contact_phone:         'Contact phone',
  address:               'Address',
  vat_id:                'VAT ID',
  default_currency:      'Default currency',
  language:              'Language',
  default_payment_terms: 'Default payment terms',
  hex_color:             'Brand color',
  logo_url:              'Logo',
}

export const QUOTATION_LABELS: Record<string, string> = {
  reference_number:    'Reference',
  customer_name:       'Customer name',
  customer_email:      'Customer email',
  customer_phone:      'Customer phone',
  customer_company:    'Company',
  customer_address:    'Address',
  customer_vat_number: 'VAT number',
  delivery_address:    'Delivery address',
  payment_terms:       'Payment terms',
  notes:               'Notes',
  title:               'Title',
  total_price:         'Total',
  currency:            'Currency',
  valid_until:         'Valid until',
  status:              'Status',
  rejection_reason_id: 'Rejection reason',
  rejection_note:      'Rejection note',
  line_items:          'Line items',
  adjustments:         'Adjustments',
}
