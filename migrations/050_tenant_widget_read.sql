-- Allow the widget (anon key) to read tenant config needed for display.
-- The tenants table only contains business/company info — no sensitive personal
-- data — so anon SELECT is safe. The widget already knows the tenant_id from
-- its embed script, so this doesn't expose any data that isn't already public.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenants'
      AND policyname = 'tenants: anon reads public config'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "tenants: anon reads public config"
        ON public.tenants FOR SELECT
        TO anon
        USING (true);
    $p$;
  END IF;
END;
$$;
