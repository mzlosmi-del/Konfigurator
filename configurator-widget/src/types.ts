export interface WidgetConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  productId: string
  tenantId: string
}

export interface FormConfig {
  show_phone?: boolean
  show_company?: boolean
  gdpr_enabled?: boolean
  gdpr_text?: string
  gdpr_link?: string
  gdpr_link_text?: string
}

export interface ProductData {
  id: string
  name: string
  name_i18n?: Record<string, string>
  description: string | null
  description_i18n?: Record<string, string>
  base_price: number
  currency: string
  ar_enabled: boolean
  ar_placement: 'floor' | 'wall'
  form_config: FormConfig
}

export interface CharacteristicValue {
  id: string
  label: string
  label_i18n?: Record<string, string>
  price_modifier: number
  sort_order: number
}

export interface Characteristic {
  id: string
  name: string
  name_i18n?: Record<string, string>
  display_type: 'select' | 'radio' | 'swatch' | 'toggle' | 'number'
  sort_order: number
  values: CharacteristicValue[]
}

export type MeshVisibilityRule = {
  type: 'visibility'
  mesh_name: string
  value_id: string
}

export type MeshDimensionRule = {
  type: 'dimension'
  node_name: string
  characteristic_id: string
  axis: 'x' | 'y' | 'z'
  value_min: number
  value_max: number
  scale_min: number
  scale_max: number
}

export type MeshRule = MeshVisibilityRule | MeshDimensionRule

export interface VisualizationAsset {
  id: string
  characteristic_value_id: string | null
  asset_type: 'image' | 'render' | '3d_model'
  url: string
  is_default: boolean
  sort_order: number
  mesh_rules: MeshRule[]
}

export interface ConfigurationRule {
  id: string
  rule_type: 'hide_value' | 'disable_value' | 'price_override' | 'set_value_default' | 'set_value_locked'
  condition: {
    characteristic_id: string
    value_id?: string
    numeric_op?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
    numeric_value?: number
  }
  effect: {
    characteristic_id?: string
    value_id?: string
    price_modifier?: number
    numeric_value?: number
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
  | { type: 'formula_result'; formula_id: string }
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
  removeBranding: boolean
  postInquiryMessage: string | null
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
