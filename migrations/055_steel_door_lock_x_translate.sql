-- Migration 055: Lock X-position translate rules for steel door
--
-- When door width changes (Door_Scalable scales along X), the Lock_* sibling
-- nodes stay at their GLB-baked X position (LX = 0.422 m for the 900 mm
-- reference door). This migration adds translate rules so the locks track the
-- handle edge as width changes within the Tier 1 range (850–1000 mm).
--
-- Reference geometry (from generate_steel_door_model.mjs):
--   DW  = 0.900 m  →  LX = DW/2 − 0.028 = 0.422 m
--
-- Delta offsets at range endpoints:
--   850 mm: handle edge = 0.425 m  →  lock X = 0.397 m  → Δ = −0.025 m
--   900 mm: handle edge = 0.450 m  →  lock X = 0.422 m  → Δ =  0.000 m  (reference)
--  1000 mm: handle edge = 0.500 m  →  lock X = 0.472 m  → Δ = +0.050 m

DO $$
DECLARE
  sys_tid uuid := '00000000-0000-0000-0000-000000000000';
  p_door  uuid;
  c_width uuid;
BEGIN

  SELECT id INTO p_door
  FROM public.products
  WHERE tenant_id = sys_tid
    AND name = 'Čelična, djelimično zastakljena vrata'
  LIMIT 1;

  IF p_door IS NULL THEN
    RAISE EXCEPTION 'Steel door template not found — run 052_steel_door_seed.sql first';
  END IF;

  SELECT id INTO c_width
  FROM public.characteristics
  WHERE tenant_id = sys_tid AND name = 'Širina (mm)'
  LIMIT 1;

  -- Append lock X-translate rules to existing mesh_rules
  UPDATE public.visualization_assets
  SET mesh_rules = mesh_rules || jsonb_build_array(
    jsonb_build_object(
      'type',              'translate',
      'node_name',         'Lock_Cylinder',
      'characteristic_id', c_width::text,
      'axis',              'x',
      'value_min',         850,    'value_max',  1000,
      'offset_min',        -0.025, 'offset_max', 0.050
    ),
    jsonb_build_object(
      'type',              'translate',
      'node_name',         'Lock_Multipoint',
      'characteristic_id', c_width::text,
      'axis',              'x',
      'value_min',         850,    'value_max',  1000,
      'offset_min',        -0.025, 'offset_max', 0.050
    ),
    jsonb_build_object(
      'type',              'translate',
      'node_name',         'Lock_Smart',
      'characteristic_id', c_width::text,
      'axis',              'x',
      'value_min',         850,    'value_max',  1000,
      'offset_min',        -0.025, 'offset_max', 0.050
    )
  )
  WHERE product_id = p_door
    AND is_default = true;

END $$;
