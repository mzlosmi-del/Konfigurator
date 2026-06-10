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
  widget_theme: string
  show_price_breakdown: boolean
  /** When true, the inquiry form lets the customer attach up to 3 images
   *  (max 20 MB each). Default false. See migration 092. */
  uploads_possible?: boolean
  /** When true, the widget groups characteristics into tabs by class (only if
   *  the product has >1 class). When false/absent, renders the flat list.
   *  Migration 091. Rows fetched before it default to flat. */
  group_into_tabs?: boolean
  /** Default combination of characteristic values the visualization shows at
   *  start: { [characteristic_id]: value_id }. Preview-only. May be absent on
   *  rows fetched before migration 090. */
  preview_defaults?: Record<string, string>
}

export interface CharacteristicValue {
  id: string
  label: string
  label_i18n?: Record<string, string>
  price_modifier: number
  sort_order: number
  hex_color?: string | null
}

export interface Characteristic {
  id: string
  name: string
  name_i18n?: Record<string, string>
  display_type: 'select' | 'radio' | 'swatch' | 'toggle' | 'number' | 'boolean'
  sort_order: number
  values: CharacteristicValue[]
  /** Optional bounds for 'number' characteristics (migration 088). */
  numeric_min?: number | null
  numeric_max?: number | null
}

/** True when `value` satisfies the optional min/max bounds. A null/undefined
 *  bound is treated as "no limit". Shared by CharacteristicInput (inline error)
 *  and Widget (submission gate). */
export function isNumericInRange(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
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

// Translate a node's position along one axis based on a numeric input.
// offset_min/max are DELTA offsets applied to the node's local position
// (useful when geometry bakes world-space positions and the node starts at origin).
export type MeshTranslateRule = {
  type: 'translate'
  node_name: string
  characteristic_id: string
  axis: 'x' | 'y' | 'z'
  value_min: number
  value_max: number
  offset_min: number
  offset_max: number
}

export type MeshTextureRule = {
  type: 'texture'
  mesh_name: string
  value_id: string
  texture_url: string
  channel: 'baseColor' | 'normal' | 'roughness'
}

export type MeshRule = MeshVisibilityRule | MeshDimensionRule | MeshTranslateRule | MeshTextureRule

export interface VisualizationAsset {
  id: string
  characteristic_value_id: string | null
  asset_type: 'image' | 'render' | '3d_model'
  url: string
  is_default: boolean
  sort_order: number
  mesh_rules: MeshRule[]
}

// Configuration rules v2 — JSONB shapes shared with the admin app. See
// migrations/074_rules_v2.sql for migration notes and the admin types in
// configurator-admin/src/types/database.ts for the canonical TS source.

export type RuleComparator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
export type RuleArithOp    = 'add' | 'subtract' | 'multiply' | 'divide'

export type NumExpr =
  | { type: 'number'; value: number }
  | { type: 'input';  char_id: string }
  | { type: 'arith';  op: RuleArithOp; left: NumExpr; right: NumExpr }

export type RulePredicate =
  | { type: 'select_eq';  char_id: string; value_id: string }
  | { type: 'select_neq'; char_id: string; value_id: string }
  | { type: 'cmp';        op: RuleComparator; left: NumExpr; right: NumExpr }

export interface RuleCondition {
  mode:       'all' | 'any'
  predicates: RulePredicate[]
}

export type RuleEffect =
  | { type: 'hide_value';          value_id: string }
  | { type: 'disable_value';       value_id: string }
  | { type: 'set_value_default';   char_id: string; value_id: string }
  // `waive_price`: when true and the rule fires, the locked value's
  // price_modifier is overridden to 0 — for "bundled / included" combos.
  | { type: 'set_value_locked';    char_id: string; value_id: string; waive_price?: boolean }
  | { type: 'set_numeric_default'; char_id: string; expr: NumExpr }
  | { type: 'set_numeric_locked';  char_id: string; expr: NumExpr }

export interface ConfigurationRule {
  id:         string
  condition:  RuleCondition
  effects:    RuleEffect[]
  is_active:  boolean
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
  name_i18n?: Record<string, string>
  formula: FormulaNode
  is_active: boolean
  sort_order: number
}

/** A group of characteristics that becomes one tab in the widget. Derived from
 *  the product's assigned characteristic classes — see buildCharacteristicGroups
 *  in charGroups.ts. The widget shows tabs only when there is more than one
 *  group; with a single group it renders the flat list as before. */
export interface CharacteristicGroup {
  id: string                          // class_id
  name: string                        // characteristic_classes.name (EN fallback)
  name_i18n?: Record<string, string>  // characteristic_classes.name_i18n JSONB
  characteristicIds: string[]         // ordered, deduped, this group only
}

export interface FullProductConfig {
  product: ProductData
  characteristics: Characteristic[]
  /** Per-class grouping of `characteristics`, used to render tabs. The flat
   *  `characteristics` array above stays the source of truth for pricing,
   *  selection, preview and the completion gate. */
  groups: CharacteristicGroup[]
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
  /** Generated client-side so the widget knows the row id for file uploads —
   *  the anon RLS policy has no SELECT, so we cannot read it back after insert. */
  id: string
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
