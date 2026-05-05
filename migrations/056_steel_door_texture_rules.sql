-- Migration 056: Texture rule placeholders for steel door colour meshes
--
-- Wires up the MeshTextureRule infrastructure for the three door-leaf materials.
-- texture_url is intentionally blank — fill in real PBR texture URLs via the
-- admin asset editor (Visualization Assets → mesh_rules) once textures are
-- uploaded to Supabase Storage.
--
-- One texture rule per colour per mesh (Door_Leaf_Black / Anthracite / White):
--   channel = 'baseColor'  — replaces the baked solid colour with a PBR texture
--
-- Run after migration 055.

DO $$
DECLARE
  sys_tid    uuid := '00000000-0000-0000-0000-000000000000';
  p_door     uuid;
  c_colour   uuid;
  v_black    uuid;
  v_anthr    uuid;
  v_white    uuid;
BEGIN

  SELECT id INTO p_door
  FROM public.products
  WHERE tenant_id = sys_tid
    AND name = 'Čelična, djelimično zastakljena vrata'
  LIMIT 1;

  IF p_door IS NULL THEN
    RAISE EXCEPTION 'Steel door template not found — run 052_steel_door_seed.sql first';
  END IF;

  SELECT id INTO c_colour
  FROM public.characteristics
  WHERE tenant_id = sys_tid AND name = 'Boja'
  LIMIT 1;

  IF c_colour IS NULL THEN
    RAISE EXCEPTION 'Colour characteristic not found';
  END IF;

  SELECT id INTO v_black
  FROM public.characteristic_values
  WHERE tenant_id = sys_tid AND characteristic_id = c_colour AND label = 'RAL 9005 Crna'
  LIMIT 1;

  SELECT id INTO v_anthr
  FROM public.characteristic_values
  WHERE tenant_id = sys_tid AND characteristic_id = c_colour AND label = 'RAL 7016 Antracit'
  LIMIT 1;

  SELECT id INTO v_white
  FROM public.characteristic_values
  WHERE tenant_id = sys_tid AND characteristic_id = c_colour AND label = 'RAL 9010 Bijela'
  LIMIT 1;

  -- Append texture rules to existing mesh_rules (placeholder URLs — update via admin UI)
  UPDATE public.visualization_assets
  SET mesh_rules = mesh_rules || jsonb_build_array(

    -- Black leaf texture
    jsonb_build_object(
      'type',        'texture',
      'mesh_name',   'Steel_Black',
      'value_id',    v_black::text,
      'texture_url', '',
      'channel',     'baseColor'
    ),

    -- Anthracite leaf texture
    jsonb_build_object(
      'type',        'texture',
      'mesh_name',   'Steel_Anthracite',
      'value_id',    v_anthr::text,
      'texture_url', '',
      'channel',     'baseColor'
    ),

    -- White leaf texture
    jsonb_build_object(
      'type',        'texture',
      'mesh_name',   'Steel_White',
      'value_id',    v_white::text,
      'texture_url', '',
      'channel',     'baseColor'
    )

  )
  WHERE product_id = p_door
    AND is_default = true;

END $$;
