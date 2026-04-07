-- =============================================================================
-- Migration: 008_inquiry_notify_trigger
--
-- Fires an async HTTP POST to the notify-inquiry Edge Function on every new
-- inquiry insert. Uses pg_net (enabled by default on Supabase) so the HTTP
-- call is non-blocking and never prevents the insert from completing.
--
-- The Edge Function URL must match your Supabase project ref.
-- Replace YOUR_PROJECT_REF with your actual project ref (e.g. laqgfdqorqksfbqkbwkl).
-- =============================================================================

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function called by the trigger
CREATE OR REPLACE FUNCTION public.notify_new_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  edge_function_url text;
  service_role_key  text;
BEGIN
  -- Build the Edge Function URL from Supabase vault or env
  -- Uses current_setting to read project-level settings set via:
  --   ALTER DATABASE postgres SET app.settings.supabase_url = '...';
  --   ALTER DATABASE postgres SET app.settings.service_role_key = '...';
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/notify-inquiry';
  service_role_key  := current_setting('app.settings.service_role_key', true);

  -- Fire-and-forget HTTP POST — failure here never blocks the INSERT
  PERFORM extensions.http_post(
    url     := edge_function_url,
    body    := json_build_object('inquiry_id', NEW.id)::text,
    headers := json_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || service_role_key
    )::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but never raise — inquiry insert must always succeed
  RAISE WARNING 'notify_new_inquiry: failed to call edge function: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_inquiry_created
  AFTER INSERT ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_inquiry();

-- ── Set project-level settings (run once, replace values) ────────────────────
-- These are read by the trigger function above.
-- Run these two lines separately with your actual values:
--
--   SELECT set_config('app.settings.supabase_url', 'https://YOUR_PROJECT_REF.supabase.co', false);
--   SELECT set_config('app.settings.service_role_key', 'YOUR_SERVICE_ROLE_KEY', false);
--
-- For persistence across restarts use ALTER DATABASE:
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
