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
  display_type: 'select' | 'radio' | 'swatch' | 'toggle' | 'number'
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
  rule_type: 'hide_value' | 'disable_value' | 'price_override' | 'set_value_default' | 'set_value_locked'
  condition: { characteristic_id: string; value_id: string }
  effect: {
    characteristic_id?: string
    value_id?: string
    price_modifier?: number
  }
  is_active: boolean
}

// ── Formula AST ─────────────────────────────────────────────────────────────
export type FormulaNode =
  | { type: 'number'; value: number }
  | { type: 'base_price' }
  | { type: 'modifier'; char_id: string }
  | { type: 'input'; char_id: string }
  | { type: 'is_selected'; char_id: string; value_id: string }
  | { type: 'add' | 'subtract' | 'multiply' | 'divide'; left: FormulaNode; right: FormulaNode }
  | { type: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'; left: FormulaNode; right: FormulaNode }
  | { type: 'and' | 'or'; left: FormulaNode; right: FormulaNode }
  | { type: 'if'; condition: FormulaNode; then: FormulaNode; else_node: FormulaNode }

export interface PricingFormula {
  id: string
  name: string
  formula: FormulaNode
  is_active: boolean
  sort_order: number
}

export interface FullProductConfig {
  product: ProductData
  characteristics: Characteristic[]
  assets: VisualizationAsset[]
  rules: ConfigurationRule[]
  formulas: PricingFormula[]
}

// Selected state: charId → valueId (for select/radio/swatch/toggle types)
export type Selection = Record<string, string>

// Numeric inputs: charId → number (for 'number' display_type characteristics)
export type NumericInputs = Record<string, number>

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
