-- Migration 092: Per-product "uploads possible" flag
--
-- Adds a boolean toggle that lets a company decide, per product, whether
-- customers may attach reference images to their inquiry from the widget.
-- Defaults to false so existing products keep their current behaviour
-- (no upload UI) until the company explicitly opts in. The widget reads
-- this column and only renders the file-upload control when it is true;
-- the inquiry_attachments RLS policy (migration 093) also gates anonymous
-- uploads on this flag.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS uploads_possible boolean NOT NULL DEFAULT false;
