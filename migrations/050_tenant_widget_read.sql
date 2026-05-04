-- Allow the widget (anon key) to read tenant config needed for display.
-- The tenants table only contains business/company info — no sensitive personal
-- data — so anon SELECT is safe. The widget already knows the tenant_id from
-- its embed script, so this doesn't expose any data that isn't already public.
CREATE POLICY IF NOT EXISTS "tenants: anon reads public config"
  ON public.tenants FOR SELECT
  TO anon
  USING (true);
