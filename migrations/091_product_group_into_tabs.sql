-- Migration 091: per-product toggle for grouping characteristics into tabs in
-- the widget. When false (the default), the widget renders the flat
-- characteristic list as it did before tabs existed. When true, characteristics
-- are split into one tab per assigned characteristic class (tabs only render
-- when the product has more than one class).
--
-- Defaults to false so existing products keep their current flat layout — this
-- is an explicit opt-in, matching the requested behaviour.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS group_into_tabs boolean NOT NULL DEFAULT false;
