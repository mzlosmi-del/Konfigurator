-- Migration 057: Backfill hex_color on the steel door RAL colour swatches
--
-- Three colour values were seeded in 052_steel_door_seed.sql before column
-- hex_color was added in 053_hex_color.sql, so they have hex_color = NULL.
-- The widget falls back to 2-letter initials when hex_color is null.
-- This patch fills the column so the swatch tile is painted in the actual
-- RAL colour.

DO $$
DECLARE
  sys_tid  uuid := '00000000-0000-0000-0000-000000000000';
  c_colour uuid;
BEGIN
  SELECT id INTO c_colour
  FROM public.characteristics
  WHERE tenant_id = sys_tid AND name = 'Boja'
  LIMIT 1;

  IF c_colour IS NULL THEN
    RAISE EXCEPTION 'Colour characteristic "Boja" not found — run 052_steel_door_seed.sql first';
  END IF;

  UPDATE public.characteristic_values
  SET hex_color = '#0A0A0D'
  WHERE tenant_id = sys_tid
    AND characteristic_id = c_colour
    AND label = 'RAL 9005 Crna';

  UPDATE public.characteristic_values
  SET hex_color = '#293133'
  WHERE tenant_id = sys_tid
    AND characteristic_id = c_colour
    AND label = 'RAL 7016 Antracit';

  UPDATE public.characteristic_values
  SET hex_color = '#F7F7F0'
  WHERE tenant_id = sys_tid
    AND characteristic_id = c_colour
    AND label = 'RAL 9010 Bijela';
END $$;
