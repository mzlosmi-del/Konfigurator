-- Migration 054: Steel door v2 mesh rules (Tier 1 + Tier 2)
--
-- Tier 1 — Tighten dimension ranges to reduce hardware distortion:
--   Width:  700–1200 mm  →  850–1000 mm  (±8% instead of ±33%)
--   Height: 1900–2400 mm → 2000–2200 mm  (±5% instead of ±12%)
--
-- Tier 2 — Per-mesh transform rules:
--   • Dimension rules now target Door_Scalable (frame + leaf + glass only).
--     Locks and hinges are siblings of Door_Scalable in the new GLB scene
--     graph and therefore no longer scale with dimension inputs.
--   • translate rules reposition the top hinge (A) of each hinge set so it
--     tracks the door height rather than staying at its GLB-baked position.
--     offset_min/max are delta offsets from the node's local origin (0 = ref).
--       Reference: HINGE_Y[0] = 1.750 m (for the 2100 mm reference door)
--       At 2000 mm door: target = 2.000 - 0.350 = 1.650 m → delta = -0.100 m
--       At 2200 mm door: target = 2.200 - 0.350 = 1.850 m → delta = +0.100 m
--
-- IMPORTANT: After running this migration, re-upload the regenerated
-- steel_door.glb (scripts/generate_steel_door_model.mjs) to Supabase Storage
-- and update the asset URL if it changed.

DO $$
DECLARE
  sys_tid  uuid := '00000000-0000-0000-0000-000000000000';
  p_door   uuid;
  c_width  uuid;
  c_height uuid;
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

  SELECT id INTO c_height
  FROM public.characteristics
  WHERE tenant_id = sys_tid AND name = 'Visina (mm)'
  LIMIT 1;

  -- Replace the two dimension rules; keep all visibility rules intact.
  -- Also add translate rules for the top hinge (A) of each hinge group.
  UPDATE public.visualization_assets
  SET mesh_rules = (
      -- All existing visibility rules (type = 'visibility')
      SELECT COALESCE(jsonb_agg(rule ORDER BY rule->>'mesh_name'), '[]'::jsonb)
      FROM   jsonb_array_elements(mesh_rules) AS rule
      WHERE  rule->>'type' = 'visibility'
    ) || jsonb_build_array(

      -- ── Width: scale Door_Scalable along X (850–1000 mm, ±8%) ──────────────
      jsonb_build_object(
        'type',              'dimension',
        'node_name',         'Door_Scalable',
        'characteristic_id', c_width::text,
        'axis',              'x',
        'value_min',         850,   'value_max',  1000,
        'scale_min',         0.944, 'scale_max',  1.111
      ),

      -- ── Height: scale Door_Scalable along Y (2000–2200 mm, ±5%) ────────────
      jsonb_build_object(
        'type',              'dimension',
        'node_name',         'Door_Scalable',
        'characteristic_id', c_height::text,
        'axis',              'y',
        'value_min',         2000,  'value_max',  2200,
        'scale_min',         0.952, 'scale_max',  1.048
      ),

      -- ── Top hinge translate rules (track door height, all three hinge sets) ─
      -- offset_min / offset_max: delta applied to node's local Y position
      -- At 2000 mm → delta −0.100 m; at 2200 mm → delta +0.100 m
      jsonb_build_object(
        'type',              'translate',
        'node_name',         'Hinge_Standard_A',
        'characteristic_id', c_height::text,
        'axis',              'y',
        'value_min',         2000, 'value_max',  2200,
        'offset_min',        -0.100, 'offset_max', 0.100
      ),
      jsonb_build_object(
        'type',              'translate',
        'node_name',         'Hinge_Concealed_A',
        'characteristic_id', c_height::text,
        'axis',              'y',
        'value_min',         2000, 'value_max',  2200,
        'offset_min',        -0.100, 'offset_max', 0.100
      ),
      jsonb_build_object(
        'type',              'translate',
        'node_name',         'Hinge_Heavy_A',
        'characteristic_id', c_height::text,
        'axis',              'y',
        'value_min',         2000, 'value_max',  2200,
        'offset_min',        -0.100, 'offset_max', 0.100
      )
    )
  WHERE product_id = p_door
    AND is_default = true;

END $$;
