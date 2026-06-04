-- =============================================================================
-- Migration: 090_product_preview_defaults
--
-- Per-product default combination of characteristic values shown by the 3D
-- model (and 2D image fallback) at start, BEFORE the customer selects anything.
--
-- Shape: { "<characteristic_id>": "<value_id>", ... }. A missing characteristic
-- falls back to today's behaviour (rule default, else the first value by
-- sort_order). NULL / '{}' means no override — nothing changes for existing
-- products.
--
-- Preview-only: this never feeds the inquiry form, price, or the "all selected"
-- gate. It only controls what the visualization renders on first paint.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN preview_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;
