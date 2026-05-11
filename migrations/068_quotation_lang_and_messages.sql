-- Migration 068: Quotation language + tenant message i18n
--
-- 1. quotations.lang   — captures the language selected when the PDF was
--    generated. The send-quotation-email and /q/:token public page both
--    read this so the customer-facing surface stays in the language the
--    quote was prepared in.
--
-- 2. tenants.quotation_email_intro_i18n    — optional per-tenant paragraph
--    inserted into the outgoing quotation email body, keyed by language.
--    Shape: { "en": "…", "sr": "…" }.
--
-- 3. tenants.quotation_accept_message_i18n — optional per-tenant message
--    displayed on /q/:token after the customer accepts. Same shape.
--
-- 4. tenants.quotation_reject_message_i18n — same, for reject.
--
-- All three JSONB columns default to {} so existing tenants behave
-- exactly as before (default copy is shown).

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'en';

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_lang_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_lang_check CHECK (lang IN ('en', 'sr'));

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS quotation_email_intro_i18n    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quotation_accept_message_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quotation_reject_message_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;
