// Hand-written types matching 001_initial_schema.sql
// When you add columns, update these too.
// Alternative: use `npx supabase gen types typescript` for auto-generated types.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ProductStatus = 'draft' | 'published' | 'archived'
export type Plan = 'free' | 'starter' | 'pro'
export type DisplayType = 'select' | 'radio' | 'swatch' | 'toggle'
export type AssetType = 'image' | 'render' | '3d_model'
export type RuleType = 'hide_value' | 'disable_value' | 'price_override'
export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed'

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          plan: Plan
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
          role: 'admin'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      characteristics: {
        Row: {
          id: string
          tenant_id: string
          name: string
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
    }
    Functions: {
      auth_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      create_tenant_for_user: {
        Args: { user_id: string; tenant_name: string; tenant_slug: string }
        Returns: void
      }
    }
  }
}

// Convenience row types
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Characteristic = Database['public']['Tables']['characteristics']['Row']
export type CharacteristicValue = Database['public']['Tables']['characteristic_values']['Row']
export type ProductCharacteristic = Database['public']['Tables']['product_characteristics']['Row']
export type VisualizationAsset = Database['public']['Tables']['visualization_assets']['Row']
export type ConfigurationRule = Database['public']['Tables']['configuration_rules']['Row']
export type Inquiry = Database['public']['Tables']['inquiries']['Row']
