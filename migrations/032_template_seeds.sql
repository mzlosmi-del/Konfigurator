-- Migration 032: Seed 8 product templates (4 furniture, 4 windows/doors)
-- Uses a DO block so UUIDs can be captured and reused across tables.

DO $$
DECLARE
  sys_tid uuid := '00000000-0000-0000-0000-000000000000';

  -- Product IDs
  p_desk    uuid; p_shelf   uuid; p_chair   uuid; p_table   uuid;
  p_window  uuid; p_sliding uuid; p_bay     uuid; p_skylight uuid;

  -- Characteristic IDs (desk)
  c_desk_size uuid; c_desk_mat uuid; c_desk_leg uuid;
  -- Characteristic IDs (shelf)
  c_shelf_w uuid; c_shelf_h uuid; c_shelf_mat uuid;
  -- Characteristic IDs (chair)
  c_chair_arm uuid; c_chair_base uuid; c_chair_fab uuid;
  -- Characteristic IDs (dining table)
  c_dt_shape uuid; c_dt_size uuid; c_dt_mat uuid;
  -- Characteristic IDs (window)
  c_win_w uuid; c_win_h uuid; c_win_open uuid; c_win_glass uuid;
  -- Characteristic IDs (sliding door)
  c_sd_w uuid; c_sd_h uuid; c_sd_frame uuid;
  -- Characteristic IDs (bay window)
  c_bay_w uuid; c_bay_style uuid; c_bay_glass uuid;
  -- Characteristic IDs (skylight)
  c_sky_size uuid; c_sky_open uuid;

  -- Value IDs we need to reference in formulas
  v_desk_size_s uuid; v_desk_size_m uuid; v_desk_size_l uuid;
  v_desk_mat_oak uuid; v_desk_mat_wal uuid; v_desk_mat_mdf uuid;
  v_desk_leg_met uuid; v_desk_leg_woo uuid;
  v_win_glass_dbl uuid; v_win_glass_tri uuid;
  v_win_open_fix uuid;
  v_sky_open_vent uuid;

BEGIN

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CUSTOM DESK
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Custom Desk', 'Configurable work desk with choice of size, material and leg style.', 299, 'EUR', 'published', true, 'Furniture')
  RETURNING id INTO p_desk;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Size',      'radio',  0) RETURNING id INTO c_desk_size;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Material',  'select', 1) RETURNING id INTO c_desk_mat;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Leg style', 'radio',  2) RETURNING id INTO c_desk_leg;

  -- Size values
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_size, sys_tid, 'Small (120 cm)',   0,   0) RETURNING id INTO v_desk_size_s;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_size, sys_tid, 'Medium (150 cm)', 80,   1) RETURNING id INTO v_desk_size_m;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_size, sys_tid, 'Large (180 cm)', 160,   2) RETURNING id INTO v_desk_size_l;

  -- Material values
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_mat, sys_tid, 'MDF',    0,  0) RETURNING id INTO v_desk_mat_mdf;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_mat, sys_tid, 'Oak',   60,  1) RETURNING id INTO v_desk_mat_oak;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_mat, sys_tid, 'Walnut', 120, 2) RETURNING id INTO v_desk_mat_wal;

  -- Leg values
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_leg, sys_tid, 'Wood leg',  0,  0) RETURNING id INTO v_desk_leg_woo;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order)
    VALUES (c_desk_leg, sys_tid, 'Metal leg', 30, 1) RETURNING id INTO v_desk_leg_met;

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order)
    VALUES (p_desk, c_desk_size, true, 0), (p_desk, c_desk_mat, true, 1), (p_desk, c_desk_leg, true, 2);

  -- Formula: base_price + size_modifier + material_modifier + leg_modifier
  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_desk, 'Total price', jsonb_build_object(
    'type', 'add',
    'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'base_price'),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_desk_size::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_desk_mat::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_desk_leg::text)
  ), true, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. BOOKSHELF
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Bookshelf', 'Choose your width, height and material.', 149, 'EUR', 'published', true, 'Furniture')
  RETURNING id INTO p_shelf;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Width',    'radio',  0) RETURNING id INTO c_shelf_w;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Height',   'radio',  1) RETURNING id INTO c_shelf_h;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Material', 'select', 2) RETURNING id INTO c_shelf_mat;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_shelf_w, sys_tid, '60 cm',   0, 0), (c_shelf_w, sys_tid, '80 cm',  30, 1), (c_shelf_w, sys_tid, '120 cm', 80, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_shelf_h, sys_tid, '100 cm',  0, 0), (c_shelf_h, sys_tid, '150 cm', 40, 1), (c_shelf_h, sys_tid, '200 cm', 90, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_shelf_mat, sys_tid, 'Pine', 0, 0), (c_shelf_mat, sys_tid, 'MDF', 0, 1), (c_shelf_mat, sys_tid, 'Oak', 50, 2);

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_shelf, c_shelf_w, true, 0), (p_shelf, c_shelf_h, true, 1), (p_shelf, c_shelf_mat, true, 2);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_shelf, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'base_price'),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_shelf_w::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_shelf_h::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_shelf_mat::text)
  ), true, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. OFFICE CHAIR
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Office Chair', 'Ergonomic chair with configurable armrests, base and upholstery.', 199, 'EUR', 'published', true, 'Furniture')
  RETURNING id INTO p_chair;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Armrests',    'radio',  0) RETURNING id INTO c_chair_arm;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Base',        'select', 1) RETURNING id INTO c_chair_base;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Upholstery',  'swatch', 2) RETURNING id INTO c_chair_fab;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_chair_arm,  sys_tid, 'None',           0, 0),
    (c_chair_arm,  sys_tid, 'Fixed',         20, 1),
    (c_chair_arm,  sys_tid, 'Adjustable',    50, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_chair_base, sys_tid, 'Nylon 5-star',   0, 0),
    (c_chair_base, sys_tid, 'Aluminium 5-star', 40, 1);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_chair_fab,  sys_tid, 'Mesh',    0, 0),
    (c_chair_fab,  sys_tid, 'Fabric', 30, 1),
    (c_chair_fab,  sys_tid, 'Leather', 80, 2);

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_chair, c_chair_arm, true, 0), (p_chair, c_chair_base, true, 1), (p_chair, c_chair_fab, true, 2);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_chair, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'base_price'),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_chair_arm::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_chair_base::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_chair_fab::text)
  ), true, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. DINING TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Dining Table', 'Choose shape, seating capacity and surface material.', 349, 'EUR', 'published', true, 'Furniture')
  RETURNING id INTO p_table;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Shape',    'radio',  0) RETURNING id INTO c_dt_shape;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Seats',    'radio',  1) RETURNING id INTO c_dt_size;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Surface',  'select', 2) RETURNING id INTO c_dt_mat;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_dt_shape, sys_tid, 'Round',     0, 0),
    (c_dt_shape, sys_tid, 'Rectangle', 0, 1),
    (c_dt_shape, sys_tid, 'Oval',     20, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_dt_size, sys_tid, '4 persons',   0, 0),
    (c_dt_size, sys_tid, '6 persons',  80, 1),
    (c_dt_size, sys_tid, '8 persons', 160, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_dt_mat, sys_tid, 'MDF',        0, 0),
    (c_dt_mat, sys_tid, 'Oak',       90, 1),
    (c_dt_mat, sys_tid, 'Walnut',   140, 2),
    (c_dt_mat, sys_tid, 'Glass top', 60, 3);

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_table, c_dt_shape, true, 0), (p_table, c_dt_size, true, 1), (p_table, c_dt_mat, true, 2);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_table, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'base_price'),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_dt_shape::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_dt_size::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_dt_mat::text)
  ), true, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SINGLE-PANE WINDOW
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Single Window', 'Standard window with opening type and glazing options.', 189, 'EUR', 'published', true, 'Windows & Doors')
  RETURNING id INTO p_window;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Width',        'radio',  0) RETURNING id INTO c_win_w;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Height',       'radio',  1) RETURNING id INTO c_win_h;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Opening type', 'radio',  2) RETURNING id INTO c_win_open;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Glazing',      'select', 3) RETURNING id INTO c_win_glass;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_win_w, sys_tid, '60 cm',  0, 0), (c_win_w, sys_tid, '90 cm', 30, 1), (c_win_w, sys_tid, '120 cm', 70, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_win_h, sys_tid, '100 cm',  0, 0), (c_win_h, sys_tid, '120 cm', 20, 1), (c_win_h, sys_tid, '150 cm', 50, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_win_open, sys_tid, 'Fixed',      0,  0) RETURNING id INTO v_win_open_fix;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_win_open, sys_tid, 'Casement',  25,  1),
    (c_win_open, sys_tid, 'Tilt-turn', 45,  2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_win_glass, sys_tid, 'Single glazing',  0, 0),
    (c_win_glass, sys_tid, 'Double glazing', 60, 1) RETURNING id INTO v_win_glass_dbl;
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_win_glass, sys_tid, 'Triple glazing', 120, 2) RETURNING id INTO v_win_glass_tri;

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_window, c_win_w, true, 0), (p_window, c_win_h, true, 1),
    (p_window, c_win_open, true, 2), (p_window, c_win_glass, true, 3);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_window, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'add',
          'left',  jsonb_build_object('type', 'base_price'),
          'right', jsonb_build_object('type', 'modifier', 'char_id', c_win_w::text)
        ),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_win_h::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_win_open::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_win_glass::text)
  ), true, 0);

  -- Rule: triple glazing only available with non-fixed opening
  INSERT INTO public.configuration_rules (tenant_id, product_id, rule_type, condition, effect, is_active)
  VALUES (sys_tid, p_window, 'hide_value',
    jsonb_build_object('characteristic_id', c_win_open::text, 'value_id', v_win_open_fix::text),
    jsonb_build_object('characteristic_id', c_win_glass::text, 'value_id', v_win_glass_tri::text),
    true
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. SLIDING DOOR
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Sliding Door', 'Sliding glass door with configurable dimensions and frame material.', 449, 'EUR', 'published', true, 'Windows & Doors')
  RETURNING id INTO p_sliding;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Width',  'radio',  0) RETURNING id INTO c_sd_w;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Height', 'radio',  1) RETURNING id INTO c_sd_h;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Frame',  'select', 2) RETURNING id INTO c_sd_frame;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_sd_w, sys_tid, '120 cm',  0, 0), (c_sd_w, sys_tid, '150 cm', 60, 1), (c_sd_w, sys_tid, '180 cm', 130, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_sd_h, sys_tid, '200 cm',  0, 0), (c_sd_h, sys_tid, '210 cm', 20, 1), (c_sd_h, sys_tid, '220 cm', 45, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_sd_frame, sys_tid, 'PVC',       0, 0),
    (c_sd_frame, sys_tid, 'Aluminium', 80, 1),
    (c_sd_frame, sys_tid, 'Wood',     110, 2);

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_sliding, c_sd_w, true, 0), (p_sliding, c_sd_h, true, 1), (p_sliding, c_sd_frame, true, 2);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_sliding, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'base_price'),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_sd_w::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_sd_h::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_sd_frame::text)
  ), true, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. BAY WINDOW
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Bay Window', 'Three-panel projecting window with style and glazing choice.', 699, 'EUR', 'published', true, 'Windows & Doors')
  RETURNING id INTO p_bay;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Width',   'radio',  0) RETURNING id INTO c_bay_w;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Style',   'radio',  1) RETURNING id INTO c_bay_style;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Glazing', 'select', 2) RETURNING id INTO c_bay_glass;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_bay_w, sys_tid, '120 cm',  0, 0), (c_bay_w, sys_tid, '150 cm', 100, 1), (c_bay_w, sys_tid, '180 cm', 200, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_bay_style, sys_tid, 'Victorian',  0, 0),
    (c_bay_style, sys_tid, 'Edwardian', 50, 1),
    (c_bay_style, sys_tid, 'Modern',    30, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_bay_glass, sys_tid, 'Double glazing',  0, 0),
    (c_bay_glass, sys_tid, 'Triple glazing', 150, 1);

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_bay, c_bay_w, true, 0), (p_bay, c_bay_style, true, 1), (p_bay, c_bay_glass, true, 2);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_bay, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'add',
        'left',  jsonb_build_object('type', 'base_price'),
        'right', jsonb_build_object('type', 'modifier', 'char_id', c_bay_w::text)
      ),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_bay_style::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_bay_glass::text)
  ), true, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. SKYLIGHT
-- ═══════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.products (tenant_id, name, description, base_price, currency, status, is_template, template_category)
  VALUES (sys_tid, 'Skylight', 'Roof skylight with size and venting options.', 399, 'EUR', 'published', true, 'Windows & Doors')
  RETURNING id INTO p_skylight;

  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Size',         'radio', 0) RETURNING id INTO c_sky_size;
  INSERT INTO public.characteristics (tenant_id, name, display_type, sort_order) VALUES (sys_tid, 'Opening type', 'radio', 1) RETURNING id INTO c_sky_open;

  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_sky_size, sys_tid, '60×60 cm',    0, 0),
    (c_sky_size, sys_tid, '90×90 cm',   80, 1),
    (c_sky_size, sys_tid, '120×120 cm', 180, 2);
  INSERT INTO public.characteristic_values (characteristic_id, tenant_id, label, price_modifier, sort_order) VALUES
    (c_sky_open, sys_tid, 'Fixed',   0, 0),
    (c_sky_open, sys_tid, 'Venting', 90, 1) RETURNING id INTO v_sky_open_vent;

  INSERT INTO public.product_characteristics (product_id, characteristic_id, is_required, sort_order) VALUES
    (p_skylight, c_sky_size, true, 0), (p_skylight, c_sky_open, true, 1);

  INSERT INTO public.pricing_formulas (tenant_id, product_id, name, formula, is_active, sort_order)
  VALUES (sys_tid, p_skylight, 'Total price', jsonb_build_object(
    'type', 'add', 'left', jsonb_build_object('type', 'add',
      'left',  jsonb_build_object('type', 'base_price'),
      'right', jsonb_build_object('type', 'modifier', 'char_id', c_sky_size::text)
    ),
    'right', jsonb_build_object('type', 'modifier', 'char_id', c_sky_open::text)
  ), true, 0);

END $$;
