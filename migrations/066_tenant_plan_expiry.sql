-- Migration 066: Plan expiry tracking
--
-- Adds three columns so we know until when a tenant's plan is paid:
--
--   • paid_until            — manual operator-set date for sales-led billing.
--                             Source of truth right now (Stripe is paused).
--   • current_period_end    — Stripe-synced renewal date for self-serve flows.
--                             Wired up by stripe-webhook only when self-serve
--                             billing is re-enabled. Currently unused.
--   • cancel_at_period_end  — Stripe flag for "ends at next renewal".
--                             Same as above — scaffolding for future Stripe re-enable.
--
-- The Billing tab in Settings prefers paid_until; falls back to
-- current_period_end. If neither is set, no expiry is shown.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS paid_until            timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end    timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  boolean NOT NULL DEFAULT false;
