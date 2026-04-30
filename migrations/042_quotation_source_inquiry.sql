-- Migration 042: link quotations back to the inquiry they were created from
--
-- Adds an optional source_inquiry_id FK on quotations so the UI can show
-- "Created from inquiry #..." and find the original inquiry later.
-- ON DELETE SET NULL: deleting an inquiry must not cascade-delete a quotation.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS source_inquiry_id uuid
    REFERENCES public.inquiries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotations_source_inquiry_idx
  ON public.quotations(source_inquiry_id);
