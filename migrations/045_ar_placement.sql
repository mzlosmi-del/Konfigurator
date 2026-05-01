-- Migration 045: per-product AR surface placement
--
-- Adds ar_placement to products so admins can specify whether the product
-- should be placed on a floor (horizontal) or wall (vertical) surface.
-- model-viewer's ar-placement attribute is set accordingly in the widget.
-- Default is 'floor' (backwards-compatible with existing products).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ar_placement text NOT NULL DEFAULT 'floor'
  CHECK (ar_placement IN ('floor', 'wall'));
