-- Migration 069: Super admin
--
-- Introduces a super-admin identity (hard-coded email: sales@configureout.com)
-- with cross-tenant visibility, plus the RPCs the /admin/tenants UI calls.
--
-- Design notes
--  • Identity is purely email-based via auth_is_super_admin(). No new column,
--    no new role — simpler than adding a flag and avoids touching profile
--    bootstrap logic.
--  • Reads from the UI go through the SECURITY DEFINER RPC
--    admin_tenant_overview(), which gates on auth_is_super_admin() and
--    therefore bypasses per-table RLS in a controlled, auditable way.
--  • Writes go through admin_set_tenant_plan(), which reuses the existing
--    apply_plan_upgrade / apply_plan_downgrade helpers from migration 039.
--  • RLS is also widened on tenants/profiles/monthly_usage and the main 048
--    authenticated policies (products, characteristics, characteristic_values,
--    inquiries, quotations) so the super admin can read across tenants from
--    any future tooling. Tenant write paths are not widened here — manual
--    edits should go through dedicated RPCs.

-- ---------------------------------------------------------------------------
-- 1. auth_is_super_admin()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.users u
     WHERE u.id = auth.uid()
       AND lower(u.email) = 'sales@configureout.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_super_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Widen RLS on tables the super admin needs to read across tenants
-- ---------------------------------------------------------------------------

-- 2a. tenants (read + update; update is still safe because writes from the UI
--     go through admin_set_tenant_plan, but we widen for future tooling)
DROP POLICY IF EXISTS "tenants: user reads own tenant"   ON public.tenants;
DROP POLICY IF EXISTS "tenants: user updates own tenant" ON public.tenants;

CREATE POLICY "tenants: user reads own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = public.auth_tenant_id() OR public.auth_is_super_admin());

CREATE POLICY "tenants: user updates own tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING      (id = public.auth_tenant_id() OR public.auth_is_super_admin())
  WITH CHECK (id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- 2b. profiles
DROP POLICY IF EXISTS "profiles: read own tenant" ON public.profiles;
CREATE POLICY "profiles: read own tenant"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- 2c. monthly_usage
DROP POLICY IF EXISTS "monthly_usage_own_tenant" ON public.monthly_usage;
CREATE POLICY "monthly_usage_own_tenant"
  ON public.monthly_usage FOR SELECT
  TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- 2d. Core business tables from migration 048
DROP POLICY IF EXISTS "products: authenticated read" ON public.products;
CREATE POLICY "products: authenticated read"
  ON public.products FOR SELECT TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = public.auth_tenant_id() AND public.auth_can('products', 'view'))
  );

DROP POLICY IF EXISTS "characteristics: authenticated read" ON public.characteristics;
CREATE POLICY "characteristics: authenticated read"
  ON public.characteristics FOR SELECT TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = public.auth_tenant_id() AND public.auth_can('products', 'view'))
  );

DROP POLICY IF EXISTS "characteristic_values: authenticated read" ON public.characteristic_values;
CREATE POLICY "characteristic_values: authenticated read"
  ON public.characteristic_values FOR SELECT TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = public.auth_tenant_id() AND public.auth_can('products', 'view'))
  );

DROP POLICY IF EXISTS "inquiries: authenticated read" ON public.inquiries;
CREATE POLICY "inquiries: authenticated read"
  ON public.inquiries FOR SELECT TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = public.auth_tenant_id() AND public.auth_can('inquiries', 'view'))
  );

DROP POLICY IF EXISTS "quotations: authenticated read" ON public.quotations;
CREATE POLICY "quotations: authenticated read"
  ON public.quotations FOR SELECT TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = public.auth_tenant_id() AND public.auth_can('quotations', 'view'))
  );

-- ---------------------------------------------------------------------------
-- 3. admin_tenant_overview() — one row per tenant with plan + usage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_tenant_overview()
RETURNS TABLE (
  id                     uuid,
  name                   text,
  slug                   text,
  plan                   text,
  paid_until             timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean,
  subscription_status    text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz,
  admin_email            text,
  products_count         int,
  members_count          int,
  inquiries_this_month   int,
  ai_setup_this_month    int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.plan::text,
    t.paid_until,
    t.current_period_end,
    t.cancel_at_period_end,
    t.subscription_status::text,
    t.stripe_customer_id,
    t.stripe_subscription_id,
    t.created_at,
    (SELECT u.email::text
       FROM public.profiles pr
       JOIN auth.users u ON u.id = pr.id
      WHERE pr.tenant_id = t.id AND pr.role = 'admin'
      ORDER BY pr.created_at ASC
      LIMIT 1) AS admin_email,
    (SELECT count(*)::int FROM public.products p
      WHERE p.tenant_id = t.id AND COALESCE(p.status, '') <> 'archived') AS products_count,
    (SELECT count(*)::int FROM public.profiles pr WHERE pr.tenant_id = t.id) AS members_count,
    COALESCE((SELECT m.inquiries_count FROM public.monthly_usage m
               WHERE m.tenant_id = t.id
                 AND m.period_month = date_trunc('month', now())::date), 0) AS inquiries_this_month,
    COALESCE((SELECT m.ai_setup_count FROM public.monthly_usage m
               WHERE m.tenant_id = t.id
                 AND m.period_month = date_trunc('month', now())::date), 0) AS ai_setup_this_month
  FROM public.tenants t
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_tenant_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_set_tenant_plan() — change plan + paid_until
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_tenant_plan(
  p_tenant_id  uuid,
  p_plan       text,
  p_paid_until timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan text;
  v_old_idx  int;
  v_new_idx  int;
BEGIN
  IF NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_plan NOT IN ('free', 'starter', 'growth', 'scale') THEN
    RAISE EXCEPTION 'invalid plan: %', p_plan USING ERRCODE = '22023';
  END IF;

  SELECT plan INTO v_old_plan
    FROM public.tenants
   WHERE id = p_tenant_id
   FOR UPDATE;

  IF v_old_plan IS NULL THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tenants
     SET plan       = p_plan,
         paid_until = p_paid_until,
         updated_at = now()
   WHERE id = p_tenant_id;

  IF v_old_plan <> p_plan THEN
    v_old_idx := array_position(ARRAY['free','starter','growth','scale'], v_old_plan);
    v_new_idx := array_position(ARRAY['free','starter','growth','scale'], p_plan);
    IF v_new_idx > v_old_idx THEN
      PERFORM public.apply_plan_upgrade(p_tenant_id);
    ELSE
      PERFORM public.apply_plan_downgrade(p_tenant_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_tenant_plan(uuid, text, timestamptz) TO authenticated;
