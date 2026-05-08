-- Migration 064: Tenant-configurable email from-address (white-label F2)
--
-- A scale-tier tenant can send quotation/invite/inquiry-notification emails
-- from their own verified domain (e.g. quotes@acme.com) instead of the
-- shared Configureout sender.
--
-- The verification step is performed via the Resend Domains API. This
-- migration only stores the configured domain + verification flag — the
-- verify-email-domain Edge Function (separate file) is responsible for
-- calling Resend and flipping email_from_verified.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_from_address  text,
  ADD COLUMN IF NOT EXISTS email_from_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resend_domain_id    text;

-- Sanity: an address must look like an email if set.
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_email_from_check;
ALTER TABLE public.tenants
  ADD  CONSTRAINT tenants_email_from_check
  CHECK (email_from_address IS NULL OR email_from_address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
