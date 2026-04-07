-- =============================================================================
-- SEED DATA — Development / Demo
-- One tenant, one product, two characteristics, several values
-- Run AFTER migration 001_initial_schema.sql
-- Run as service_role (bypasses RLS) in Supabase SQL editor
-- =============================================================================

-- Fixed UUIDs for repeatability in dev
DO $$
DECLARE
  v_tenant_id   uuid := 'a1000000-0000-0000-0000-000000000001';
  v_user_id     uuid := 'a2000000-0000-0000-0000-000000000001';  -- must match an auth.users row
  v_product_id  uuid := 'a3000000-0000-0000-0000-000000000001';
  v_char_mat    uuid := 'a4000000-0000-0000-0000-000000000001';  -- characteristic: Material
  v_char_size   uuid := 'a4000000-0000-0000-0000-000000000002';  -- characteristic: Size
  v_val_oak     uuid := 'a5000000-0000-0000-0000-000000000001';
  v_val_walnut  uuid := 'a5000000-0000-0000-0000-000000000002';
  v_val_pine    uuid := 'a5000000-0000-0000-0000-000000000003';
  v_val_s80     uuid := 'a5000000-0000-0000-0000-000000000004';
  v_val_s100    uuid := 'a5000000-0000-0000-0000-000000000005';
  v_val_s120    uuid := 'a5000000-0000-0000-0000-000000000006';
BEGIN

  -- -------------------------------------------------------------------------
  -- Tenant
  -- -------------------------------------------------------------------------
  INSERT INTO public.tenants (id, name, slug, plan)
  VALUES (v_tenant_id, 'Firma X', 'firma-x', 'starter')
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Profile (link to a real auth.users row — replace v_user_id with actual UUID
  -- after creating a user in Supabase Auth dashboard or via sign-up)
  -- -------------------------------------------------------------------------
  -- INSERT INTO public.profiles (id, tenant_id, role)
  -- VALUES (v_user_id, v_tenant_id, 'admin')
  -- ON CONFLICT (id) DO NOTHING;
  -- NOTE: Commented out — profiles are created automatically by handle_new_user()
  -- trigger. Only uncomment if you're inserting a pre-existing auth user manually.

  -- -------------------------------------------------------------------------
  -- Product
  -- -------------------------------------------------------------------------
  INSERT INTO public.products (id, tenant_id, name, description, base_price, currency, status)
  VALUES (
    v_product_id,
    v_tenant_id,
    'Solid Wood Dining Table',
    'Handcrafted dining table made from sustainably sourced solid wood. Available in multiple sizes and finishes.',
    800.00,
    'EUR',
    'published'
  )
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Characteristics
  -- -------------------------------------------------------------------------
  INSERT INTO public.characteristics (id, tenant_id, name, display_type, sort_order)
  VALUES
    (v_char_mat,  v_tenant_id, 'Material', 'swatch',  1),
    (v_char_size, v_tenant_id, 'Size',     'radio',   2)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Attach characteristics to product
  -- -------------------------------------------------------------------------
  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order)
  VALUES
    (v_product_id, v_char_mat,  true, 1),
    (v_product_id, v_char_size, true, 2)
  ON CONFLICT (product_id, characteristic_id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Characteristic values
  -- -------------------------------------------------------------------------

  -- Material values
  INSERT INTO public.characteristic_values (id, characteristic_id, tenant_id, label, price_modifier, sort_order)
  VALUES
    (v_val_oak,    v_char_mat, v_tenant_id, 'Oak',    0.00,   1),
    (v_val_walnut, v_char_mat, v_tenant_id, 'Walnut', 150.00, 2),
    (v_val_pine,   v_char_mat, v_tenant_id, 'Pine',   -50.00, 3)
  ON CONFLICT (id) DO NOTHING;

  -- Size values
  INSERT INTO public.characteristic_values (id, characteristic_id, tenant_id, label, price_modifier, sort_order)
  VALUES
    (v_val_s80,  v_char_size, v_tenant_id, '80×80 cm',   0.00,  1),
    (v_val_s100, v_char_size, v_tenant_id, '100×100 cm', 80.00, 2),
    (v_val_s120, v_char_size, v_tenant_id, '120×80 cm',  120.00, 3)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Visualization assets
  -- -------------------------------------------------------------------------
  -- Default product image (no characteristic_value_id = shown before any selection)
  INSERT INTO public.visualization_assets (tenant_id, product_id, characteristic_value_id, asset_type, url, is_default, sort_order)
  VALUES
    (v_tenant_id, v_product_id, NULL,        'image', 'https://placehold.co/800x600?text=Default+Table', true,  0),
    (v_tenant_id, v_product_id, v_val_oak,   'image', 'https://placehold.co/800x600?text=Oak+Table',     false, 1),
    (v_tenant_id, v_product_id, v_val_walnut,'image', 'https://placehold.co/800x600?text=Walnut+Table',  false, 2),
    (v_tenant_id, v_product_id, v_val_pine,  'image', 'https://placehold.co/800x600?text=Pine+Table',    false, 3)
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Configuration rule example:
  -- IF Material = Pine THEN disable Size = 120x80 cm (not available in pine)
  -- -------------------------------------------------------------------------
  INSERT INTO public.configuration_rules (tenant_id, product_id, rule_type, condition, effect, is_active)
  VALUES (
    v_tenant_id,
    v_product_id,
    'disable_value',
    jsonb_build_object('characteristic_id', v_char_mat::text,  'value_id', v_val_pine::text),
    jsonb_build_object('characteristic_id', v_char_size::text, 'value_id', v_val_s120::text),
    true
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed complete. Tenant: %, Product: %', v_tenant_id, v_product_id;

END $$;
