-- =============================================================================
-- Migration: 016_fix_tenant_id_defaults_rules_formulas
--
-- Same root cause as migration 009: configuration_rules, pricing_formulas,
-- characteristic_values, and visualization_assets have tenant_id NOT NULL but
-- no DEFAULT, so inserts that omit tenant_id produce NULL which fails the
-- RLS WITH CHECK (tenant_id = auth_tenant_id()) with 403 Forbidden.
-- =============================================================================

ALTER TABLE public.configuration_rules
  ALTER COLUMN tenant_id SET DEFAULT auth_tenant_id();

ALTER TABLE public.pricing_formulas
  ALTER COLUMN tenant_id SET DEFAULT auth_tenant_id();

ALTER TABLE public.characteristic_values
  ALTER COLUMN tenant_id SET DEFAULT auth_tenant_id();

ALTER TABLE public.visualization_assets
  ALTER COLUMN tenant_id SET DEFAULT auth_tenant_id();
