-- Migration 048: Per-role authorization system
-- Adds role_permissions table + helper functions + updated RLS on key tables.

-- 1. Helper: return the current user's role
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Per-tenant, per-role permission matrix
CREATE TABLE IF NOT EXISTS public.role_permissions (
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('member', 'viewer')),
  functionality text NOT NULL,
  level         text NOT NULL CHECK (level IN ('none', 'view', 'edit')),
  PRIMARY KEY (tenant_id, role, functionality)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated tenant members can read their own tenant's permissions
-- (needed so non-admin users can load their own permission map on login)
CREATE POLICY "role_permissions: read own tenant"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id());

-- Only admins can manage permissions
CREATE POLICY "role_permissions: admin write"
  ON public.role_permissions FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_role() = 'admin');

-- 3. Helper: check if the current user can perform p_level on p_functionality.
--    Admin always returns true. Missing row = false (deny by default).
CREATE OR REPLACE FUNCTION public.auth_can(p_functionality text, p_level text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role  text;
  v_level text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF v_role = 'admin' THEN RETURN true; END IF;
  IF v_role IS NULL THEN RETURN false; END IF;
  SELECT level INTO v_level
    FROM public.role_permissions
    WHERE tenant_id = auth_tenant_id()
      AND role = v_role
      AND functionality = p_functionality;
  IF v_level IS NULL THEN RETURN false; END IF;
  RETURN CASE
    WHEN p_level = 'view' THEN v_level IN ('view', 'edit')
    WHEN p_level = 'edit' THEN v_level = 'edit'
    ELSE false
  END;
END;
$$;

-- 4. Seed defaults for ALL existing tenants
--    member  → edit on all functionalities (full write access)
--    viewer  → view on all functionalities (read-only everywhere)
INSERT INTO public.role_permissions (tenant_id, role, functionality, level)
SELECT t.id, r.role, f.func, r.default_level
FROM public.tenants t
CROSS JOIN (VALUES ('member','edit'),('viewer','view')) AS r(role, default_level)
CROSS JOIN (
  VALUES ('dashboard'),('products'),('pricing'),('library'),('texts'),
         ('inquiries'),('quotations'),('analytics'),('embed'),('settings')
) AS f(func)
ON CONFLICT DO NOTHING;

-- 5. Update handle_new_user() to also seed role_permissions for new tenants
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_tenant_name  text;
  v_tenant_slug  text;
  v_tenant_id    uuid;
  v_invite_token text;
  v_invite       record;
BEGIN
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite
    FROM public.invitations
    WHERE token = v_invite_token
      AND accepted_at IS NULL
      AND expires_at > now()
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.profiles (id, tenant_id, role, email)
      VALUES (NEW.id, v_invite.tenant_id, v_invite.role, NEW.email);

      UPDATE public.invitations
      SET accepted_at = now()
      WHERE id = v_invite.id;

      RETURN NEW;
    END IF;
  END IF;

  -- Normal signup: create new tenant + admin profile + default role_permissions
  v_tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', split_part(NEW.email, '@', 1));
  v_tenant_slug := COALESCE(NEW.raw_user_meta_data->>'tenant_slug',
                    regexp_replace(lower(v_tenant_name), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.tenants (name, slug)
  VALUES (v_tenant_name, v_tenant_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, role, email)
  VALUES (NEW.id, v_tenant_id, 'admin', NEW.email);

  -- Seed default role_permissions for the new tenant
  INSERT INTO public.role_permissions (tenant_id, role, functionality, level)
  SELECT v_tenant_id, r.role, f.func, r.default_level
  FROM (VALUES ('member','edit'),('viewer','view')) AS r(role, default_level)
  CROSS JOIN (
    VALUES ('dashboard'),('products'),('pricing'),('library'),('texts'),
           ('inquiries'),('quotations'),('analytics'),('embed'),('settings')
  ) AS f(func);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update write RLS policies on products, quotations, inquiries to enforce
--    functionality-level permissions.  admin always passes via auth_can().

-- products ----------------------------------------------------------------
DROP POLICY IF EXISTS "products: tenant admin full access" ON public.products;

CREATE POLICY "products: authenticated read"
  ON public.products FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('products', 'view'));

CREATE POLICY "products: authenticated write"
  ON public.products FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('products', 'edit'))
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('products', 'edit'));

-- characteristics (part of the products functionality) --------------------
DROP POLICY IF EXISTS "characteristics: tenant admin full access" ON public.characteristics;

CREATE POLICY "characteristics: authenticated read"
  ON public.characteristics FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('products', 'view'));

CREATE POLICY "characteristics: authenticated write"
  ON public.characteristics FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('products', 'edit'))
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('products', 'edit'));

-- characteristic_values ---------------------------------------------------
DROP POLICY IF EXISTS "characteristic_values: tenant admin full access" ON public.characteristic_values;

CREATE POLICY "characteristic_values: authenticated read"
  ON public.characteristic_values FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('products', 'view'));

CREATE POLICY "characteristic_values: authenticated write"
  ON public.characteristic_values FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('products', 'edit'))
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('products', 'edit'));

-- inquiries ---------------------------------------------------------------
DROP POLICY IF EXISTS "inquiries: tenant admin full access" ON public.inquiries;

CREATE POLICY "inquiries: authenticated read"
  ON public.inquiries FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('inquiries', 'view'));

-- Only edit-level users can update/delete; anon insert policy stays untouched
CREATE POLICY "inquiries: authenticated write"
  ON public.inquiries FOR UPDATE TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('inquiries', 'edit'))
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('inquiries', 'edit'));

-- quotations --------------------------------------------------------------
DROP POLICY IF EXISTS "tenant access" ON public.quotations;

CREATE POLICY "quotations: authenticated read"
  ON public.quotations FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('quotations', 'view'));

CREATE POLICY "quotations: authenticated write"
  ON public.quotations FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('quotations', 'edit'))
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('quotations', 'edit'));
