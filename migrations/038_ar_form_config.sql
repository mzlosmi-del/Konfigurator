-- Phase 8: AR toggle + lead-capture form config per product

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ar_enabled   bool    NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS form_config  jsonb   NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.products.ar_enabled  IS 'Show AR button on model-viewer (growth+ only, plan-gated in UI)';
COMMENT ON COLUMN public.products.form_config IS 'Lead-capture form field config: {show_phone, show_company, gdpr_enabled, gdpr_text, gdpr_link, gdpr_link_text}';
