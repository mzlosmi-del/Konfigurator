-- Add 'boolean' display_type for characteristics.
--
-- A boolean characteristic renders as a single checkbox in the widget. It
-- still uses the standard characteristic_values table, but admin should
-- create exactly one value to represent the "checked" state — its
-- price_modifier provides the price impact, and its label is admin-only
-- (renderers omit the value label for boolean items so customers see just
-- the characteristic name).

ALTER TABLE public.characteristics
  DROP CONSTRAINT characteristics_display_type_check,
  ADD CONSTRAINT characteristics_display_type_check
    CHECK (display_type IN ('select', 'radio', 'swatch', 'toggle', 'number', 'boolean'));
