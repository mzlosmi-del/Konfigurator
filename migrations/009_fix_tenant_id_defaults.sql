-- =============================================================================
-- Migration: 009_fix_tenant_id_defaults
-- Fix 403 Forbidden on product and characteristic creation.
--
-- Root cause: products.tenant_id and characteristics.tenant_id have no DEFAULT,
-- so INSERT calls that omit tenant_id (as the admin app does) produce a NULL
-- value. The RLS WITH CHECK expression evaluates NULL = auth_tenant_id() as
-- NULL (not TRUE), which Supabase rejects with 403 Forbidden.
--
-- Fix: set DEFAULT auth_tenant_id() on both columns so that omitted tenant_id
-- is automatically populated from the authenticated user's profile. The RLS
-- check then evaluates auth_tenant_id() = auth_tenant_id() which is TRUE.
-- =============================================================================

ALTER TABLE public.products
  ALTER COLUMN tenant_id SET DEFAULT auth_tenant_id();

ALTER TABLE public.characteristics
  ALTER COLUMN tenant_id SET DEFAULT auth_tenant_id();
