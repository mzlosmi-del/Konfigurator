-- =============================================================================
-- Migration: 007_add_notification_email
--
-- Adds notification_email to tenants so each workspace can configure where
-- new inquiry emails are sent. Defaults to NULL — when NULL the Edge Function
-- falls back to the auth.users email of the tenant's admin profile.
-- =============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS notification_email text
    CHECK (notification_email IS NULL OR notification_email ~* '^[^@]+@[^@]+\.[^@]+$');

COMMENT ON COLUMN public.tenants.notification_email IS
  'Where new inquiry notifications are sent. Falls back to the admin account email if NULL.';
