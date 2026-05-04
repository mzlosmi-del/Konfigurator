// Hand-written types matching 001_initial_schema.sql
// When you add columns, update these too.
// Alternative: use `npx supabase gen types typescript` for auto-generated types.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ProductStatus = 'draft' | 'published' | 'archived'
export type Plan = 'free' | 'starter' | 'growth' | 'scale'
export type DisplayType = 'select' | 'radio' | 'swatch' | 'toggle' | 'number'
export type AssetType = 'image' | 'render' | '3d_model'
export type RuleType = 'hide_value' | 'disable_value' | 'price_override' | 'set_value_default' | 'set_value_locked'
export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed'
export type QuoteStatus = 'sent' | 'expired'
export type QuotationStatus =
  | 'in_preparation'
  | 'confirmed_sent'
  | 'accepted_no_changes'
  | 'accepted_with_changes'
  | 'rejected'
  | 'expired'
export type AdjustmentType = 'surcharge' | 'discount' | 'tax'

export interface QuotationConfigItem {
  characteristic_id:   string
  characteristic_name: string
  value_id:            string
  value_label:         string
  price_modifier:      number
}

export interface QuotationLineItem {
  product_id:      string
  product_name:    string
  product_sku:     string | null
  unit_of_measure: string | null
  quantity:        number
  unit_price:      number
  configuration:   QuotationConfigItem[]
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
          post_inquiry_message: string | null
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
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
          name_i18n: Json
          description_i18n: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_texts: {
        Row: {
          id: string
          tenant_id: string
          product_id: string | null
          label: string
          content: string
          text_type: string
          language: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_texts']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_texts']['Insert']>
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
          name_i18n: Json
          display_type: DisplayType
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['characteristics']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['characteristics']['Insert']>
      }
      characteristic_values: {
        Row: {
          id: string
          characteristic_id: string
          tenant_id: string
          label: string
          label_i18n: Json
          price_modifier: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['characteristic_values']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['visualization_assets']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['visualization_assets']['Insert']>
      }
      configuration_rules: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          rule_type: RuleType
          condition: Json
          effect: Json
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inquiries']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
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
      pricing_formulas: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          name: string
          formula: Json           // FormulaNode AST
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['pricing_formulas']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['pricing_formulas']['Insert']>
      }
      quotes: {
        Row: {
          id: string
          inquiry_id: string
          tenant_id: string
          pdf_url: string | null
          expires_at: string | null
          status: QuoteStatus
          sent_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'created_at' | 'updated_at' | 'sent_at'> & { id?: string; sent_at?: string }
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['quotations']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['quotations']['Insert']>
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
    }
  }
}

// Typed shapes for configuration_rules JSONB columns
export interface RuleCondition {
  characteristic_id: string
  // Select-type condition: characteristic has value_id selected
  value_id?: string
  // Numeric condition: characteristic input compared against a threshold
  numeric_op?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  numeric_value?: number
}
export interface RuleEffect {
  characteristic_id?: string
  value_id?: string          // target value for select-type characteristics
  price_modifier?: number    // price_override amount
  numeric_value?: number     // set_value_default / set_value_locked on numeric chars
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
export type ProductCharacteristic = Database['public']['Tables']['product_characteristics']['Row']
export type VisualizationAsset = Database['public']['Tables']['visualization_assets']['Row']
export type ConfigurationRule = Omit<
  Database['public']['Tables']['configuration_rules']['Row'],
  'condition' | 'effect'
> & { condition: RuleCondition; effect: RuleEffect }
export type Inquiry            = Database['public']['Tables']['inquiries']['Row']
export type Quote              = Database['public']['Tables']['quotes']['Row']
export type CharacteristicClass  = Database['public']['Tables']['characteristic_classes']['Row']
export type ClassMember          = Database['public']['Tables']['characteristic_class_members']['Row']
export type ProductClass         = Database['public']['Tables']['product_classes']['Row']
export type PricingFormula       = Database['public']['Tables']['pricing_formulas']['Row']
export type Quotation                  = Database['public']['Tables']['quotations']['Row']
export type ProductText                = Database['public']['Tables']['product_texts']['Row']
export type ProductTextType            = 'product' | 'specification' | 'note' | 'terms'
export type QuotationRejectionReason   = Database['public']['Tables']['quotation_rejection_reasons']['Row']
export type RolePermission             = Database['public']['Tables']['role_permissions']['Row']
export type PermLevel                  = 'none' | 'view' | 'edit'
