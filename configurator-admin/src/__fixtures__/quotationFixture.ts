// Hand-written fixture used by both the Playwright harness in
// src/test-harness/ and any vitest test that wants realistic document-generator
// input. Single "happy path" scenario for v1: two products with multiple
// characteristics, line-level + quotation-level adjustments, EN+SR texts at
// every tenant_texts level, and image assets for the tech-spec.

import type {
  Quotation,
  QuotationLineItem,
  QuotationAdjustment,
  TenantText,
  VisualizationAsset,
  Json,
} from '@/types/database'
import type { TenantProfile } from '@/lib/pdf/shared'

const TENANT_ID  = '00000000-0000-0000-0000-00000000aaaa'
const PROD_DESK  = '00000000-0000-0000-0000-0000000001de'
const PROD_CHAIR = '00000000-0000-0000-0000-0000000001ce'

const CHAR_MATERIAL = '00000000-0000-0000-0000-0000000010aa'
const CHAR_FINISH   = '00000000-0000-0000-0000-0000000010ab'
const CHAR_SIZE     = '00000000-0000-0000-0000-0000000010ac'
const CHAR_BACK     = '00000000-0000-0000-0000-0000000010ba'

const VAL_OAK        = '00000000-0000-0000-0000-000000002001'
const VAL_WALNUT     = '00000000-0000-0000-0000-000000002002'
const VAL_MATT       = '00000000-0000-0000-0000-000000002003'
const VAL_GLOSS      = '00000000-0000-0000-0000-000000002004'
const VAL_SIZE_LARGE = '00000000-0000-0000-0000-000000002005'
const VAL_BACK_HIGH  = '00000000-0000-0000-0000-000000002006'

export const tenant: TenantProfile = {
  name:                'Acme Furniture Workshop',
  // logo_url is intentionally null in v1 — loadLogoBytes uses
  // URL.createObjectURL + new Image, which is a path we don't want the v1
  // fixture to traverse yet (see plan: Risks & mitigations).
  logo_url:            null,
  company_address:     '12 Wood Street, 11000 Belgrade, Serbia',
  company_phone:       '+381 11 555 0123',
  company_email:       'hello@acme.example',
  company_website:     'acme.example',
  contact_person:      'Mila Petrović',
  vat_number:          'RS123456789',
  company_reg_number:  '12345678',
  pdf_footer:          null,
}

const deskConfig: QuotationLineItem = {
  product_id:      PROD_DESK,
  product_name:    'Studio Desk 140',
  product_sku:     'DESK-140',
  unit_of_measure: 'pc',
  quantity:        2,
  // Stored unit_price is the fully-configured per-unit price (base 540 + Oak
  // +60 + Matt +0 + 140 cm +0). Per src/lib/quotations.ts:152 calcLineTotal
  // only multiplies unit_price × quantity and ignores configuration
  // price_modifiers — they're informational columns for the PDF, not summed.
  unit_price:      600,
  configuration: [
    {
      characteristic_id:   CHAR_MATERIAL,
      characteristic_name: 'Material',
      characteristic_description_i18n: {
        en: 'Solid hardwood top.',
        sr: 'Ploča od punog drveta.',
      },
      value_id:       VAL_OAK,
      value_label:    'Oak',
      price_modifier: 60,
    },
    {
      characteristic_id:   CHAR_FINISH,
      characteristic_name: 'Finish',
      characteristic_description_i18n: {
        en: 'Surface treatment.',
        sr: 'Završna obrada.',
      },
      value_id:       VAL_MATT,
      value_label:    'Matt',
      price_modifier: 0,
    },
    {
      characteristic_id:   CHAR_SIZE,
      characteristic_name: 'Size',
      characteristic_description_i18n: {
        en: 'Top width in cm.',
        sr: 'Širina ploče u cm.',
      },
      value_id:       VAL_SIZE_LARGE,
      value_label:    '140 cm',
      price_modifier: 0,
    },
  ],
  adjustments: [
    { type: 'discount', label: 'Showroom display discount', mode: 'percent', value: 5 },
  ],
}

const chairConfig: QuotationLineItem = {
  product_id:      PROD_CHAIR,
  product_name:    'Office Chair Pro',
  product_sku:     'CHAIR-PRO',
  unit_of_measure: 'pc',
  quantity:        4,
  // Fully-configured per-unit price (base 320 + Walnut +80 + Gloss +15 +
  // High back +0). See note on Studio Desk above.
  unit_price:      415,
  configuration: [
    {
      characteristic_id:   CHAR_MATERIAL,
      characteristic_name: 'Material',
      characteristic_description_i18n: {
        en: 'Frame material.',
        sr: 'Materijal rama.',
      },
      value_id:       VAL_WALNUT,
      value_label:    'Walnut',
      price_modifier: 80,
    },
    {
      characteristic_id:   CHAR_FINISH,
      characteristic_name: 'Finish',
      characteristic_description_i18n: {
        en: 'Surface treatment.',
        sr: 'Završna obrada.',
      },
      value_id:       VAL_GLOSS,
      value_label:    'Gloss',
      price_modifier: 15,
    },
    {
      characteristic_id:   CHAR_BACK,
      characteristic_name: 'Backrest',
      characteristic_description_i18n: {
        en: 'Backrest type.',
        sr: 'Vrsta naslona.',
      },
      value_id:       VAL_BACK_HIGH,
      value_label:    'High',
      price_modifier: 0,
    },
  ],
}

const quotationAdjustments: QuotationAdjustment[] = [
  { type: 'discount',  label: 'Bulk order',  mode: 'percent', value: 7  },
  { type: 'tax',       label: 'VAT 20%',     mode: 'percent', value: 20 },
]

// Pre-computed totals (matching calcLineTotal / calcSubtotal / calcTotal in
// src/lib/quotations.ts). The renderers re-derive these from line_items +
// adjustments, but we store them on the row to mirror real production data.
//
//   desk:  2 × 600 = 1200, then -5% = 1140
//   chair: 4 × 415 = 1660  (no line-level adjustments)
//   subtotal = 1140 + 1660 = 2800
//   -7% discount      = 2800 × 0.93 = 2604
//   +20% VAT          = 2604 × 1.20 = 3124.8
const QUOTATION_SUBTOTAL = 2800
const QUOTATION_TOTAL    = 3124.8

export const quotation: Quotation = {
  id:                   '00000000-0000-0000-0000-0000000000q1',
  tenant_id:            TENANT_ID,
  reference_number:     'Q-2026-0042',
  customer_name:        'Jovan Marković',
  customer_email:       'jovan@example.com',
  customer_company:     'Markovic Studios',
  customer_phone:       '+381 60 444 5555',
  customer_address:     'Knez Mihailova 10, 11000 Belgrade',
  customer_vat_number:  'RS987654321',
  delivery_address:     null,
  notes:                'Please ship between 09:00 and 17:00.',
  title:                'Workshop furniture refresh',
  payment_terms:        '50% on order, 50% on delivery.',
  valid_until:          '2026-06-30',
  currency:             'EUR',
  subtotal:             QUOTATION_SUBTOTAL,
  total_price:          QUOTATION_TOTAL,
  status:               'in_preparation',
  line_items:           [deskConfig, chairConfig] as unknown as Json,
  adjustments:          quotationAdjustments as unknown as Json,
  pdf_url:              null,
  rejection_reason_id:  null,
  rejection_note:       null,
  source_inquiry_id:    null,
  public_token:         null,
  responded_at:         null,
  responded_ip:         null,
  responded_user_agent: null,
  lang:                 'en',
  tokens_charged_at:    null,
  tokens_charged:       0,
  created_at:           '2026-05-01T10:00:00.000Z',
  updated_at:           '2026-05-01T10:00:00.000Z',
}

export const texts: TenantText[] = [
  // Tenant-level
  row('tenant', null, 'terms_line', 'en',
      'All prices are exclusive of delivery unless stated otherwise.'),
  row('tenant', null, 'terms_line', 'sr',
      'Sve cene su bez troškova dostave osim ako nije drugačije navedeno.'),
  row('tenant', null, 'post_inquiry_message', 'en',
      'Thanks for your interest. We will reply within one business day.'),
  row('tenant', null, 'post_inquiry_message', 'sr',
      'Hvala na interesovanju. Odgovaramo u roku od jednog radnog dana.'),

  // Product-level
  row('product', PROD_DESK, 'description', 'en',
      'A solid-wood writing desk designed for small studios.'),
  row('product', PROD_DESK, 'description', 'sr',
      'Radni sto od punog drveta za male studije.'),
  row('product', PROD_DESK, 'specification', 'en',
      'Dimensions: 140 × 70 × 75 cm. Net weight 38 kg.'),
  row('product', PROD_DESK, 'specification', 'sr',
      'Dimenzije: 140 × 70 × 75 cm. Neto težina 38 kg.'),

  row('product', PROD_CHAIR, 'description', 'en',
      'Ergonomic office chair with adjustable lumbar support.'),
  row('product', PROD_CHAIR, 'description', 'sr',
      'Ergonomska kancelarijska stolica sa podesivim lumbalnim osloncem.'),
  row('product', PROD_CHAIR, 'specification', 'en',
      'Seat height 42–52 cm. Tested to 120 kg.'),
  row('product', PROD_CHAIR, 'specification', 'sr',
      'Visina sedišta 42–52 cm. Testirano do 120 kg.'),

  // Characteristic-level
  row('characteristic', CHAR_MATERIAL, 'description', 'en',
      'Choose the wood species for the visible surfaces.'),
  row('characteristic', CHAR_MATERIAL, 'description', 'sr',
      'Izaberite vrstu drveta za vidljive površine.'),

  // Characteristic-value-level
  row('characteristic_value', VAL_OAK, 'specification', 'en',
      'Oak: medium density, light golden grain.'),
  row('characteristic_value', VAL_OAK, 'specification', 'sr',
      'Hrast: srednja gustoća, svetla zlatna tekstura.'),
  row('characteristic_value', VAL_WALNUT, 'specification', 'en',
      'Walnut: high density, dark chocolate grain.'),
  row('characteristic_value', VAL_WALNUT, 'specification', 'sr',
      'Orah: velika gustoća, tamnočokoladna tekstura.'),
]

// Visualization assets — used by quotationTechSpecDocx for product / value
// imagery. Inline 1×1 transparent PNG data URL keeps the fixture
// network-free and deterministic. The generator's image-load path is still
// exercised end-to-end (fetch + URL.createObjectURL + new Image); content
// tests don't assert the image bytes, only that surrounding text rendered.
const PIXEL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export const assets: VisualizationAsset[] = [
  assetRow(PROD_DESK,  null,        '00000000-0000-0000-0000-0000000030a1'),
  assetRow(PROD_DESK,  VAL_OAK,     '00000000-0000-0000-0000-0000000030a2'),
  assetRow(PROD_CHAIR, null,        '00000000-0000-0000-0000-0000000030b1'),
  assetRow(PROD_CHAIR, VAL_WALNUT,  '00000000-0000-0000-0000-0000000030b2'),
]

/** Re-export so the harness / tests don't need to know the math. */
export const expected = {
  subtotal: QUOTATION_SUBTOTAL,
  total:    QUOTATION_TOTAL,
  currency: 'EUR' as const,
  desk:     { unitPrice: 600, quantity: 2, lineTotal: 1140 },
  chair:    { unitPrice: 415, quantity: 4, lineTotal: 1660 },
}

function row(
  level:    TenantText['level'],
  refId:    string | null,
  slot:     string,
  language: 'en' | 'sr',
  content:  string,
): TenantText {
  return {
    id:           `${level}-${refId ?? 'tenant'}-${slot}-${language}`,
    tenant_id:    TENANT_ID,
    level,
    reference_id: refId,
    slot,
    language,
    sort_order:   0,
    label:        null,
    content,
    created_at:   '2026-05-01T10:00:00.000Z',
    updated_at:   '2026-05-01T10:00:00.000Z',
  }
}

function assetRow(
  productId:    string,
  valueId:      string | null,
  id:           string,
): VisualizationAsset {
  return {
    id,
    tenant_id:               TENANT_ID,
    product_id:              productId,
    characteristic_value_id: valueId,
    asset_type:              'image',
    url:                     PIXEL_PNG_DATA_URL,
    is_default:              valueId === null,
    sort_order:              0,
    mesh_rules:              {} as Json,
    read_only:               false,
    created_at:              '2026-05-01T10:00:00.000Z',
    updated_at:              '2026-05-01T10:00:00.000Z',
  }
}
