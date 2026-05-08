-- Migration 063: Tenant-configurable PDF footer (white-label F1)
--
-- A scale-tier tenant can replace the hardcoded "Configureout" footer in
-- generated quotation PDFs with their own copy. Falls back to the default
-- when null or when the tenant's plan does not include white_label.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS pdf_footer text;
