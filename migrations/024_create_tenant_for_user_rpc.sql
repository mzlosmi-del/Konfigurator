-- RPC called from the client immediately after supabase.auth.signUp().
-- Creates the tenant row and the admin profile for the new user.
-- SECURITY DEFINER lets it bypass RLS since the user has no profile yet.
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(
  user_id     uuid,
  tenant_name text,
  tenant_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  safe_slug     text;
BEGIN
  -- Only the user themselves may call this (prevent impersonation)
  IF auth.uid() IS DISTINCT FROM user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Idempotent: skip if profile already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    RETURN;
  END IF;

  -- Resolve slug collision by appending part of the user id
  safe_slug := tenant_slug;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = safe_slug) THEN
    safe_slug := tenant_slug || '-' || substr(user_id::text, 1, 8);
  END IF;

  INSERT INTO public.tenants (name, slug)
  VALUES (tenant_name, safe_slug)
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, role)
  VALUES (user_id, new_tenant_id, 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_for_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_for_user(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_for_user(uuid, text, text) TO anon;
