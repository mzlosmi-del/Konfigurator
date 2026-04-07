export interface WidgetConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  productId: string
  tenantId: string
}

export interface ProductData {
  id: string
  name: string
  description: string | null
  base_price: number
  currency: string
}

export interface CharacteristicValue {
  id: string
  label: string
  price_modifier: number
  sort_order: number
}

export interface Characteristic {
  id: string
  name: string
  display_type: 'select' | 'radio' | 'swatch' | 'toggle'
  sort_order: number
  values: CharacteristicValue[]
}

export interface VisualizationAsset {
  id: string
  characteristic_value_id: string | null
  asset_type: 'image' | 'render' | '3d_model'
  url: string
  is_default: boolean
  sort_order: number
}

export interface ConfigurationRule {
  id: string
  rule_type: 'hide_value' | 'disable_value' | 'price_override'
  condition: { characteristic_id: string; value_id: string }
  effect: {
    characteristic_id?: string
    value_id?: string
    price_modifier?: number
  }
  is_active: boolean
}

export interface FullProductConfig {
  product: ProductData
  characteristics: Characteristic[]
  assets: VisualizationAsset[]
  rules: ConfigurationRule[]
}

// Selected state: charId → valueId
export type Selection = Record<string, string>

export interface InquiryPayload {
  tenant_id: string
  product_id: string
  customer_name: string
  customer_email: string
  message: string
  configuration: ConfigLineItem[]
  total_price: number
  currency: string
}

export interface ConfigLineItem {
  characteristic_name: string
  value_label: string
  price_modifier: number
}
