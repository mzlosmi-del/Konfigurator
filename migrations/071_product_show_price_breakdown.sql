-- Migration 071: Per-product "show price breakdown" toggle
--
-- Controls whether the widget renders the price breakdown
-- (base + characteristic modifiers + formula contributions) under the
-- configurator, or just the final total. Defaults to true so existing
-- products behave as before.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_price_breakdown boolean NOT NULL DEFAULT true;
