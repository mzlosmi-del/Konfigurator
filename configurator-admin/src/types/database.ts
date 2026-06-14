// Hand-written types matching 001_initial_schema.sql
// When you add columns, update these too.
// Alternative: use `npx supabase gen types typescript` for auto-generated types.

import type { OutputLang } from '@/lib/languages'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ProductStatus = 'draft' | 'published' | 'archived'
export type Plan = 'free' | 'starter' | 'growth' | 'scale'

/** Levels supported by the central `tenant_texts` table (see migration 076).
 *  Tenant rows have `reference_id = null`; the other three resolve against
 *  products / characteristics / characteristic_values respectively. */
export type TextLevel = 'tenant' | 'product' | 'characteristic' | 'characteristic_value' | 'pricing_formula'

/** Canonical slot names used by the renderers when looking up text. The
 *  central editor accepts arbitrary strings so tenants can introduce custom
 *  slots, but these are the ones that have built-in renderer support today. */
export const TEXT_SLOTS = {
  tenant: [
    'pdf_footer',
    'public_page_title',
    'post_inquiry_message',
    'quotation_email_intro',
    'quotation_accept_message',
    'quotation_reject_message',
    'terms_line',
    // multi-block "global text" slots — inherit text_type names from the
    // legacy product_texts table so they round-trip cleanly.
    'product', 'specification', 'note', 'terms',
  ],
  product: [
    'name', 'description',
    'product', 'specification', 'note', 'terms',
  ],
  characteristic:       ['name', 'description', 'specification'] as const,
  characteristic_value: ['label', 'description', 'specification'] as const,
  pricing_formula:      ['name'] as const,
} as const

/** Multi-row slots — i.e. ones whose `sort_order` matters and a single
 *  (level, reference, slot, language) can have more than one row. */
export const MULTI_ROW_SLOTS = new Set<string>([
  'terms_line',
  'product', 'specification', 'note', 'terms',
])
export type DisplayType = 'select' | 'radio' | 'swatch' | 'toggle' | 'number' | 'boolean' | 'text' | 'color'
export type AssetType = 'image' | 'render' | '3d_model'

/** Live neon-text-preview config for a `display_type = 'text'` characteristic
 *  (migration 096). Stored in `characteristics.neon_config` (nullable JSONB).
 *  NULL or `enabled !== true` ⇒ the characteristic renders as a plain text
 *  field exactly as before — the feature is strictly opt-in and additive. The
 *  typed string's character count still drives price through the existing text
 *  channel; this config only controls the visual glow preview. */
export interface NeonConfig {
  enabled: boolean
  /** Optional custom label text (falls back to the i18n default "Your sign text"). */
  label?: string
  /** UI max length for the input (default 30). `numeric_max` remains the priced/validation bound. */
  maxLength?: number | null
  /** Subset of the bundled font keys offered to the customer; the first is the default. */
  fonts: string[]
  /** Sibling colour/swatch characteristic whose selected value drives the glow colour. */
  colorCharId?: string | null
  /** Optional per-value glow-hex overrides, keyed by characteristic_value id. */
  glowColorMap?: Record<string, string>
  /** Fallback glow colour when no bound value resolves to a hex. */
  defaultGlowHex?: string
  /** When true, customers can paint each character a different colour (picked
   *  from the bound colour swatches) by clicking it in the live preview.
   *  Default off ⇒ the whole text glows in one colour. */
  perCharColors?: boolean
  /** Background-scene keys (from the bundled scene catalogue) the customer may
   *  pick as a backdrop behind the glow. Empty/absent ⇒ no scene picker. */
  backgrounds?: string[]
}
// Configuration rules v2 — see migrations/074_rules_v2.sql.
//
// Each rule has a flat ALL/ANY predicate list and an array of effects.
// The narrow v1 shape (one trigger, one effect, rule_type discriminator)
// is migrated row-by-row into this shape; no rule_type column remains.

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
  | { type: 'hide_value';         value_id: string }
  | { type: 'disable_value';      value_id: string }
  | { type: 'set_value_default';  char_id: string; value_id: string }
  // `waive_price`: when true and the rule fires, the locked value's
  // price_modifier is overridden to 0 — used for "bundled / included"
  // combos where the lock target should not add cost to the total.
  | { type: 'set_value_locked';   char_id: string; value_id: string; waive_price?: boolean }
  | { type: 'set_numeric_default'; char_id: string; expr: NumExpr }
  | { type: 'set_numeric_locked';  char_id: string; expr: NumExpr }

/** Discriminator for rule effects — handy in switches and UI labels. */
export type RuleEffectKind = RuleEffect['type']
export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed'
export type QuotationStatus =
  | 'in_preparation'
  | 'confirmed'
  | 'sent'
  | 'accepted_no_changes'
  | 'accepted_with_changes'
  | 'rejected'
  | 'expired'
export type AdjustmentType = 'surcharge' | 'discount' | 'tax'

export interface QuotationConfigItem {
  characteristic_id:          string
  characteristic_name:        string
  /** Snapshot of characteristics.description_i18n at save time, e.g. { en: "...", sr: "..." }.
   *  The PDF renderer picks the entry matching the chosen export language; missing or empty
   *  entries are skipped. Undefined for legacy line items saved before this column existed. */
  characteristic_description_i18n?: Record<string, string>
  value_id:                   string
  value_label:                string
  price_modifier:             number
}

export interface QuotationFormulaItem {
  formula_id:   string
  formula_name: string
  amount:       number
}

export interface QuotationLineItem {
  product_id:      string
  product_name:    string
  product_sku:     string | null
  unit_of_measure: string | null
  quantity:        number
  unit_price:      number
  configuration:   QuotationConfigItem[]
  formulas?:       QuotationFormulaItem[]
  adjustments?:    QuotationAdjustment[]
}

export interface QuotationAdjustment {
  type:  AdjustmentType
  label: string
  mode:  'percent' | 'fixed'
  value: number
}

// ── Formula AST ─────────────────────────────────────────────────────────────
// Stored as JSONB in pricing_formulas.formula.
// Evaluated in the widget to produce a numeric surcharge/discount.
export type FormulaNode =
  | { type: 'number'; value: number }
  | { type: 'base_price' }
  | { type: 'modifier'; char_id: string }                                  // price_modifier of selected value
  | { type: 'input'; char_id: string }                                     // numeric user input
  | { type: 'is_selected'; char_id: string; value_id: string }             // boolean: is value selected
  | { type: 'formula_result'; formula_id: string }                         // result of another formula
  | { type: 'add' | 'subtract' | 'multiply' | 'divide'; left: FormulaNode; right: FormulaNode }
  | { type: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'; left: FormulaNode; right: FormulaNode }
  | { type: 'and' | 'or'; left: FormulaNode; right: FormulaNode }
  | { type: 'if'; condition: FormulaNode; then: FormulaNode; else_node: FormulaNode }

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          plan: Plan
          notification_email: string | null
          company_address: string | null
          company_phone:   string | null
          company_email:   string | null
          company_website: string | null
          contact_person:  string | null
          logo_url:            string | null
          vat_number:          string | null
          company_reg_number:  string | null
          email_from_address:  string | null
          email_from_verified: boolean
          resend_domain_id:    string | null
          favicon_url:         string | null
          show_powered_by:     boolean
          paid_until:          string | null
          current_period_end:  string | null
          cancel_at_period_end: boolean
          tokens_granted:      number
          tokens_spent:        number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          role: 'admin' | 'member' | 'viewer'
          email: string | null
          ui_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at' | 'ui_preferences'> & { ui_preferences?: Json }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      role_permissions: {
        Row: {
          tenant_id: string
          role: 'member' | 'viewer'
          functionality: string
          level: 'none' | 'view' | 'edit'
        }
        Insert: {
          tenant_id: string
          role: 'member' | 'viewer'
          functionality: string
          level: 'none' | 'view' | 'edit'
        }
        Update: {
          tenant_id?: string
          role?: 'member' | 'viewer'
          functionality?: string
          level?: 'none' | 'view' | 'edit'
        }
      }
      products: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          base_price: number
          currency: string
          status: ProductStatus
          sort_order: number
          sku: string | null
          unit_of_measure: string | null
          is_template: boolean
          template_category: string | null
          public_slug: string | null
          public_preview_enabled: boolean
          read_only: boolean
          ar_enabled: boolean
          ar_placement: 'floor' | 'wall'
          form_config: Json
          widget_theme: string
          show_price_breakdown: boolean
          /** When true, the widget lets customers attach up to 3 images
           *  (max 20 MB each) to their inquiry. Default false. See migration 092. */
          uploads_possible: boolean
          /** When true, the widget splits characteristics into one tab per
           *  assigned characteristic class (tabs render only with >1 class).
           *  When false (default) it renders the flat list. See migration 091. */
          group_into_tabs: boolean
          /** Default combination of characteristic values shown by the
           *  visualization at start: { [characteristic_id]: value_id }.
           *  Preview-only — never feeds the form, price, or the gate. See
           *  migration 090. Empty object means "no override". */
          preview_defaults: Record<string, string>
          /** In-memory translation maps populated from `tenant_texts` by the
           *  fetch helpers. The DB columns were dropped in migration 078 —
           *  these fields are not selected from PostgreSQL anymore. */
          name_i18n?:        Record<string, string>
          description_i18n?: Record<string, string>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at' | 'show_price_breakdown' | 'group_into_tabs' | 'uploads_possible' | 'preview_defaults' | 'name_i18n' | 'description_i18n'> & { id?: string; show_price_breakdown?: boolean; group_into_tabs?: boolean; uploads_possible?: boolean; preview_defaults?: Record<string, string> }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      characteristic_classes: {
        Row: {
          id: string
          tenant_id: string
          name: string
          name_i18n: Json
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['characteristic_classes']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['characteristic_classes']['Insert']>
      }
      characteristic_class_members: {
        Row: {
          class_id: string
          characteristic_id: string
          sort_order: number
        }
        Insert: { class_id: string; characteristic_id: string; sort_order?: number }
        Update: Partial<Database['public']['Tables']['characteristic_class_members']['Insert']>
      }
      characteristics: {
        Row: {
          id: string
          tenant_id: string
          name: string
          display_type: DisplayType
          sort_order: number
          /**
           * Optional bounds for `display_type = 'number'` characteristics (migration 088).
           * Reused as min/max allowed character length for `display_type = 'text'` (migration 089).
           */
          numeric_min: number | null
          numeric_max: number | null
          /** Per-character price for `display_type = 'text'` characteristics (migration 089). */
          price_per_char: number
          /** Flat fee applied when a colour is chosen for `display_type = 'color'` (migration 089). */
          color_price_modifier: number
          /** Live neon-text-preview config for `display_type = 'text'` (migration 096).
           *  NULL ⇒ feature off; the characteristic renders as a plain text field. */
          neon_config: NeonConfig | null
          /** In-memory translations populated from `tenant_texts`. */
          name_i18n?:        Record<string, string>
          description_i18n?: Record<string, string>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['characteristics']['Row'], 'id' | 'created_at' | 'updated_at' | 'name_i18n' | 'description_i18n'> & { id?: string }
        Update: Partial<Database['public']['Tables']['characteristics']['Insert']>
      }
      characteristic_values: {
        Row: {
          id: string
          characteristic_id: string
          tenant_id: string
          label: string
          price_modifier: number
          sort_order: number
          hex_color: string | null
          /** In-memory translations populated from `tenant_texts`. */
          label_i18n?: Record<string, string>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['characteristic_values']['Row'], 'id' | 'created_at' | 'updated_at' | 'label_i18n'> & { id?: string }
        Update: Partial<Database['public']['Tables']['characteristic_values']['Insert']>
      }
      product_characteristics: {
        Row: {
          id: string
          product_id: string
          characteristic_id: string
          is_required: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_characteristics']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_characteristics']['Insert']>
      }
      visualization_assets: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          characteristic_value_id: string | null
          asset_type: AssetType
          url: string
          is_default: boolean
          sort_order: number
          mesh_rules: Json
          read_only: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['visualization_assets']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['visualization_assets']['Insert']>
      }
      visualization_assignments: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          asset_id: string
          priority: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['visualization_assignments']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['visualization_assignments']['Insert']>
      }
      visualization_assignment_conditions: {
        Row: {
          id: string
          tenant_id: string
          assignment_id: string
          characteristic_id: string
          operator: 'eq' | 'gt' | 'lt'
          value_id: string | null
          numeric_value: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['visualization_assignment_conditions']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['visualization_assignment_conditions']['Insert']>
      }
      configuration_rules: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          condition: Json
          effects:   Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['configuration_rules']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['configuration_rules']['Insert']>
      }
      inquiries: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          customer_name: string
          customer_email: string
          message: string | null
          configuration: Json
          total_price: number | null
          currency: string
          status: InquiryStatus
          token_locked: boolean
          tokens_charged: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inquiries']['Row'], 'id' | 'created_at' | 'updated_at' | 'token_locked' | 'tokens_charged'>
          & { id?: string; token_locked?: boolean; tokens_charged?: number }
        Update: Partial<Database['public']['Tables']['inquiries']['Insert']>
      }
      product_classes: {
        Row: {
          product_id: string
          class_id: string
          sort_order: number
        }
        Insert: { product_id: string; class_id: string; sort_order?: number }
        Update: Partial<Database['public']['Tables']['product_classes']['Insert']>
      }
      // Per-product override for the flat display order of characteristics in
      // the widget. A row exists only for explicitly-ordered characteristics;
      // others fall back to the class-derived order. See migration 089.
      product_characteristic_order: {
        Row: {
          product_id: string
          characteristic_id: string
          sort_order: number
        }
        Insert: { product_id: string; characteristic_id: string; sort_order?: number }
        Update: Partial<Database['public']['Tables']['product_characteristic_order']['Insert']>
      }
      pricing_formulas: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          name: string
          formula: Json           // FormulaNode AST
          is_active: boolean
          sort_order: number
          /** In-memory translation map populated from `tenant_texts`
           *  (level='pricing_formula', slot='name'). Not a DB column —
           *  resolved by the fetch helpers, never selected from PostgreSQL. */
          name_i18n?:        Record<string, string>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['pricing_formulas']['Row'], 'id' | 'created_at' | 'updated_at' | 'name_i18n'> & { id?: string }
        Update: Partial<Database['public']['Tables']['pricing_formulas']['Insert']>
      }
      quotation_attachments: {
        Row: {
          id:           string
          tenant_id:    string
          quotation_id: string
          storage_path: string
          filename:     string
          mime_type:    string
          size_bytes:   number
          created_at:   string
        }
        Insert: Omit<Database['public']['Tables']['quotation_attachments']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['quotation_attachments']['Insert']>
      }
      inquiry_attachments: {
        Row: {
          id:           string
          tenant_id:    string
          inquiry_id:   string
          storage_path: string
          filename:     string
          mime_type:    string
          size_bytes:   number
          created_at:   string
        }
        Insert: Omit<Database['public']['Tables']['inquiry_attachments']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['inquiry_attachments']['Insert']>
      }
      quotation_rejection_reasons: {
        Row: {
          id:         string
          tenant_id:  string
          label:      string
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['quotation_rejection_reasons']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['quotation_rejection_reasons']['Insert']>
      }
      product_price_schedules: {
        Row: {
          id:         string
          tenant_id:  string
          product_id: string
          price:      number
          valid_from: string
          valid_to:   string | null
          note:       string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_price_schedules']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_price_schedules']['Insert']>
      }
      characteristic_modifier_schedules: {
        Row: {
          id:                      string
          tenant_id:               string
          characteristic_value_id: string
          price_modifier:          number
          valid_from:              string
          valid_to:                string | null
          note:                    string | null
          created_at:              string
          updated_at:              string
        }
        Insert: Omit<Database['public']['Tables']['characteristic_modifier_schedules']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['characteristic_modifier_schedules']['Insert']>
      }
      product_tax_presets: {
        Row: {
          id:         string
          tenant_id:  string
          product_id: string
          label:      string
          rate:       number
          valid_from: string
          valid_to:   string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_tax_presets']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_tax_presets']['Insert']>
      }
      product_adjustment_presets: {
        Row: {
          id:              string
          tenant_id:       string
          product_id:      string
          label:           string
          adjustment_type: 'surcharge' | 'discount'
          mode:            'percent' | 'fixed'
          value:           number
          valid_from:      string
          valid_to:        string | null
          created_at:      string
          updated_at:      string
        }
        Insert: Omit<Database['public']['Tables']['product_adjustment_presets']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_adjustment_presets']['Insert']>
      }
      quotations: {
        Row: {
          id: string
          tenant_id: string
          reference_number: string
          customer_name: string
          customer_email: string
          customer_company: string | null
          customer_phone: string | null
          customer_address:     string | null
          customer_vat_number:  string | null
          delivery_address:     string | null
          notes: string | null
          title: string | null
          payment_terms: string | null
          valid_until: string | null
          currency: string
          subtotal: number
          total_price: number
          status: QuotationStatus
          line_items: Json      // QuotationLineItem[]
          adjustments: Json     // QuotationAdjustment[]
          pdf_url: string | null
          rejection_reason_id: string | null
          rejection_note:      string | null
          source_inquiry_id:   string | null
          public_token:        string | null
          responded_at:        string | null
          responded_ip:        string | null
          responded_user_agent: string | null
          lang:                OutputLang
          tokens_charged_at:   string | null
          tokens_charged:      number
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['quotations']['Row'],
          'id' | 'created_at' | 'updated_at' | 'public_token' | 'responded_at' | 'responded_ip' | 'responded_user_agent' | 'lang' | 'tokens_charged_at' | 'tokens_charged'
        > & {
          id?:                   string
          public_token?:         string | null
          responded_at?:         string | null
          responded_ip?:         string | null
          responded_user_agent?: string | null
          lang?:                 OutputLang
          tokens_charged_at?:    string | null
          tokens_charged?:       number
        }
        Update: Partial<Database['public']['Tables']['quotations']['Insert']>
      }
      audit_log: {
        Row: {
          id:              string
          tenant_id:       string
          entity_type:     string
          entity_id:       string
          entity_name:     string | null
          change_type:     'create' | 'update' | 'delete'
          changed_by:      string | null
          changed_by_name: string | null
          changed_at:      string
          diff:            Record<string, { old: unknown; new: unknown }> | null
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'changed_at'> & { id?: string; changed_at?: string }
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
      }
      tenant_texts: {
        Row: {
          id:           string
          tenant_id:    string
          level:        TextLevel
          reference_id: string | null
          slot:         string
          language:     'en' | 'sr'
          sort_order:   number
          label:        string | null
          content:      string
          created_at:   string
          updated_at:   string
        }
        Insert: Omit<Database['public']['Tables']['tenant_texts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string
          sort_order?: number
          label?:      string | null
          content?:    string
        }
        Update: Partial<Database['public']['Tables']['tenant_texts']['Insert']>
      }
      document_templates: {
        Row: {
          id:          string
          tenant_id:   string
          name:        string
          output_kind: 'pdf' | 'docx' | 'xlsx'
          definition:  Json   // DocumentTemplateDefinition (see lib/docTemplate/types.ts)
          is_default:  boolean
          created_at:  string
          updated_at:  string
        }
        Insert: Omit<Database['public']['Tables']['document_templates']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string
          definition?: Json
          is_default?: boolean
        }
        Update: Partial<Database['public']['Tables']['document_templates']['Insert']>
      }
    }
    Functions: {
      auth_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      auth_role: {
        Args: Record<string, never>
        Returns: string
      }
      auth_can: {
        Args: { p_functionality: string; p_level: string }
        Returns: boolean
      }
      create_tenant_for_user: {
        Args: { user_id: string; tenant_name: string; tenant_slug: string }
        Returns: void
      }
      import_catalog: {
        Args: { payload: Json }
        Returns: {
          classes_created:         number
          characteristics_created: number
          values_created:          number
          products_created:        number
          texts_created:           number
        }
      }
    }
  }
}

// ── plan_limits ───────────────────────────────────────────────────────────────
export interface PlanLimitsRow {
  plan:                 Plan
  products_max:         number
  inquiries_per_month:  number
  team_members_max:     number
  three_d:              boolean
  quotations:           boolean
  webhooks:             boolean
  remove_branding:      boolean
  white_label:          boolean
  ai_setup_per_month:   number
  analytics:            'basic' | 'advanced'
}

// ── monthly_usage ─────────────────────────────────────────────────────────────
export interface MonthlyUsageRow {
  tenant_id:       string
  period_month:    string
  inquiries_count: number
  ai_setup_count:  number
}

// Convenience row types
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Characteristic = Database['public']['Tables']['characteristics']['Row']
export type CharacteristicValue = Database['public']['Tables']['characteristic_values']['Row']
export type CharacteristicValueInsert = Database['public']['Tables']['characteristic_values']['Insert']
export type ProductCharacteristic = Database['public']['Tables']['product_characteristics']['Row']
export type VisualizationAsset = Database['public']['Tables']['visualization_assets']['Row']
export type ConfigurationRule = Omit<
  Database['public']['Tables']['configuration_rules']['Row'],
  'condition' | 'effects'
> & { condition: RuleCondition; effects: RuleEffect[] }
export type Inquiry            = Database['public']['Tables']['inquiries']['Row']
export type CharacteristicClass  = Database['public']['Tables']['characteristic_classes']['Row']
export type ClassMember          = Database['public']['Tables']['characteristic_class_members']['Row']
export type ProductClass         = Database['public']['Tables']['product_classes']['Row']
export type PricingFormula       = Database['public']['Tables']['pricing_formulas']['Row']
export type PricingFormulaInsert = Database['public']['Tables']['pricing_formulas']['Insert']
export type Quotation                  = Database['public']['Tables']['quotations']['Row']
// product_texts table was dropped in migration 078; its content lives in
// tenant_texts now. The legacy `ProductText` / `ProductTextType` exports
// were removed at the same time.
export type TenantText                 = Database['public']['Tables']['tenant_texts']['Row']
export type TenantTextInsert           = Database['public']['Tables']['tenant_texts']['Insert']
export type TenantTextUpdate           = Database['public']['Tables']['tenant_texts']['Update']
export type DocumentTemplate           = Database['public']['Tables']['document_templates']['Row']
export type DocumentTemplateInsert     = Database['public']['Tables']['document_templates']['Insert']
export type DocumentTemplateUpdate     = Database['public']['Tables']['document_templates']['Update']
export type QuotationRejectionReason   = Database['public']['Tables']['quotation_rejection_reasons']['Row']
export type QuotationAttachment        = Database['public']['Tables']['quotation_attachments']['Row']
export type InquiryAttachment          = Database['public']['Tables']['inquiry_attachments']['Row']
export type RolePermission             = Database['public']['Tables']['role_permissions']['Row']
export type PermLevel                  = 'none' | 'view' | 'edit'
export type AuditLog                   = Database['public']['Tables']['audit_log']['Row']
export type AuditEntityType =
  | 'product'
  | 'characteristic'
  | 'characteristic_value'
  | 'class'
  | 'pricing_schedule'
  | 'pricing_formula'
  | 'product_text'
  | 'global_text'
  | 'settings'
  | 'quotation'
  | 'visualization_assignment'
