-- Migration 053: Add optional hex_color to characteristic_values
-- Enables colour-swatch display in the configurator widget for options
-- whose display_type is 'swatch'. Null = no colour override (shows initials).

ALTER TABLE public.characteristic_values
  ADD COLUMN IF NOT EXISTS hex_color text;

COMMENT ON COLUMN public.characteristic_values.hex_color
  IS 'Optional CSS hex colour string (e.g. #2563eb) shown as a colour tile in swatch display.';
