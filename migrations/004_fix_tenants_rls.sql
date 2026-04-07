-- =============================================================================
-- Migration: 004_fix_tenants_rls
-- Fixes 406 error when admin app reads the tenants table.
-- Run this in Supabase SQL Editor if you hit a 406 on /rest/v1/tenants
-- =============================================================================

-- Enable RLS on tenants (was missing from initial migration)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read only their own tenant row
CREATE POLICY IF NOT EXISTS "tenants: user reads own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = auth_tenant_id());

-- Authenticated users can update their own tenant (for settings page later)
CREATE POLICY IF NOT EXISTS "tenants: user updates own tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (id = auth_tenant_id())
  WITH CHECK (id = auth_tenant_id());
