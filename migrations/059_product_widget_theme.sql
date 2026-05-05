-- Migration 059: Add widget_theme to products
--
-- Persists the chosen widget style per product so the embed snippet
-- and the widget itself can apply the correct theme automatically.
-- Default: 'cloud' (matches current hardcoded widget default).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS widget_theme text NOT NULL DEFAULT 'cloud';
