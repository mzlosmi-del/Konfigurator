-- Migration 039: Synchronise plan tiers to target structure
-- Idempotent: safe to re-run on both fresh and existing databases.
-- All limits driven from plan_limits; no hardcoded numbers in triggers.

-- ── 1. Add display price columns to plan_limits (informational, not Stripe IDs) ──

ALTER TABLE public.plan_limits
  ADD COLUMN IF NOT EXISTS monthly_price_eur  int  NOT NULL DEFAULT 0,   -- in cents
  ADD COLUMN IF NOT EXISTS annual_price_eur   int  NOT NULL DEFAULT 0;   -- in cents

-- ── 2. Upsert all 4 tiers with target values ─────────────────────────────────
--    ON CONFLICT ensures re-running is safe.

INSERT INTO public.plan_limits
  (plan, products_max, inquiries_per_month, team_members_max,
   three_d, quotations, webhooks, remove_branding, white_label,
   ai_setup_per_month, analytics,
   monthly_price_eur, annual_price_eur)
VALUES
  ('free',     3,    25,   1, false, false, false, false, false,   0, 'basic',     0,      0),
  ('starter', 25,   250,   3, true,  true,  false, false, false,   5, 'basic',  4900,  49000),
  ('growth',  -1,  2000,  10, true,  true,  true,  true,  false,  50, 'advanced',14900, 149000),
  ('scale',   -1,    -1,  -1, true,  true,  true,  true,  true,  -1, 'advanced',39900, 399000)
ON CONFLICT (plan) DO UPDATE SET
  products_max         = EXCLUDED.products_max,
  inquiries_per_month  = EXCLUDED.inquiries_per_month,
  team_members_max     = EXCLUDED.team_members_max,
  three_d              = EXCLUDED.three_d,
  quotations           = EXCLUDED.quotations,
  webhooks             = EXCLUDED.webhooks,
  remove_branding      = EXCLUDED.remove_branding,
  white_label          = EXCLUDED.white_label,
  ai_setup_per_month   = EXCLUDED.ai_setup_per_month,
  analytics            = EXCLUDED.analytics,
  monthly_price_eur    = EXCLUDED.monthly_price_eur,
  annual_price_eur     = EXCLUDED.annual_price_eur;

-- ── 3. Delete any rogue plan rows ─────────────────────────────────────────────

DELETE FROM public.plan_limits WHERE plan NOT IN ('free','starter','growth','scale');

-- ── 4. profiles.over_limit — member read-only flag on downgrade ───────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS over_limit bool NOT NULL DEFAULT false;

-- ── 5. backfill_log — audit table for automated migrations ───────────────────

CREATE TABLE IF NOT EXISTS public.backfill_log (
  id           bigserial    PRIMARY KEY,
  operation    text         NOT NULL,
  tenant_id    uuid         REFERENCES public.tenants(id) ON DELETE SET NULL,
  old_value    text,
  new_value    text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.backfill_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backfill_log_read" ON public.backfill_log
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

-- ── 6. Backfill: set unknown plans → 'free' and log ──────────────────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, plan FROM public.tenants
    WHERE plan NOT IN ('free','starter','growth','scale')
  LOOP
    INSERT INTO public.backfill_log (operation, tenant_id, old_value, new_value)
    VALUES ('plan_backfill_to_free', r.id, r.plan, 'free');
    UPDATE public.tenants SET plan = 'free' WHERE id = r.id;
  END LOOP;
END $$;

-- ── 7. Updated trigger functions with structured error JSON ───────────────────
--    Error message is JSON so clients can parse code/dimension/plan.

CREATE OR REPLACE FUNCTION public.check_product_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan  text;
  v_max   int;
  v_count int;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT products_max INTO v_max FROM public.plan_limits WHERE plan = v_plan;
  IF v_max IS NULL THEN v_max := 3; END IF;

  IF v_max >= 0 THEN
    SELECT COUNT(*) INTO v_count
      FROM public.products WHERE tenant_id = NEW.tenant_id AND status != 'archived';
    IF v_count >= v_max THEN
      RAISE EXCEPTION '%', json_build_object(
        'code',       'PLAN_LIMIT_EXCEEDED',
        'dimension',  'products',
        'current',    v_count,
        'limit',      v_max,
        'plan',       v_plan,
        'upgrade_to', CASE v_plan WHEN 'free' THEN 'starter' WHEN 'starter' THEN 'growth' ELSE 'scale' END
      )::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_inquiry_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan   text;
  v_max    int;
  v_count  int;
  v_period date;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT inquiries_per_month INTO v_max FROM public.plan_limits WHERE plan = v_plan;
  IF v_max IS NULL OR v_max < 0 THEN RETURN NEW; END IF;

  v_period := date_trunc('month', now())::date;
  SELECT COALESCE(inquiries_count, 0) INTO v_count
    FROM public.monthly_usage
   WHERE tenant_id = NEW.tenant_id AND period_month = v_period;

  IF v_count >= v_max THEN
    RAISE EXCEPTION '%', json_build_object(
      'code',       'PLAN_LIMIT_EXCEEDED',
      'dimension',  'inquiries',
      'current',    v_count,
      'limit',      v_max,
      'plan',       v_plan,
      'upgrade_to', CASE v_plan WHEN 'free' THEN 'starter' WHEN 'starter' THEN 'growth' ELSE 'scale' END
    )::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_team_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan  text;
  v_max   int;
  v_count int;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT team_members_max INTO v_max FROM public.plan_limits WHERE plan = v_plan;
  IF v_max IS NULL OR v_max < 0 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE tenant_id = NEW.tenant_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION '%', json_build_object(
      'code',       'PLAN_LIMIT_EXCEEDED',
      'dimension',  'team_members',
      'current',    v_count,
      'limit',      v_max,
      'plan',       v_plan,
      'upgrade_to', CASE v_plan WHEN 'free' THEN 'starter' WHEN 'starter' THEN 'growth' ELSE 'scale' END
    )::text;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 8. handle_plan_downgrade — marks over-limit resources, pauses webhooks ────
--    Called by stripe-webhook after downgrade. Replaces mark_over_limit_products.

CREATE OR REPLACE FUNCTION public.handle_plan_downgrade(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_plan         text;
  v_prod_max     int;
  v_member_max   int;
  v_webhooks_ok  bool;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  SELECT products_max, team_members_max, webhooks
    INTO v_prod_max, v_member_max, v_webhooks_ok
    FROM public.plan_limits WHERE plan = v_plan;

  -- Products: keep first N by created_at, mark rest read_only
  IF v_prod_max >= 0 THEN
    UPDATE public.products SET read_only = false WHERE tenant_id = p_tenant_id;
    UPDATE public.products SET read_only = true
    WHERE tenant_id = p_tenant_id
      AND id NOT IN (
        SELECT id FROM public.products
        WHERE tenant_id = p_tenant_id
        ORDER BY created_at ASC
        LIMIT v_prod_max
      );
  END IF;

  -- Team members: mark excess over_limit (first N by created_at are OK)
  IF v_member_max >= 0 THEN
    UPDATE public.profiles SET over_limit = false WHERE tenant_id = p_tenant_id;
    UPDATE public.profiles SET over_limit = true
    WHERE tenant_id = p_tenant_id
      AND id NOT IN (
        SELECT id FROM public.profiles
        WHERE tenant_id = p_tenant_id
        ORDER BY created_at ASC
        LIMIT v_member_max
      );
  END IF;

  -- Webhooks: pause all if plan doesn't allow webhooks
  IF NOT v_webhooks_ok THEN
    UPDATE public.webhook_endpoints
      SET enabled = false
    WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

-- ── 9. Clear over_limit flags on upgrade ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_plan_upgrade(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_webhooks_ok bool;
BEGIN
  SELECT webhooks INTO v_webhooks_ok
    FROM public.plan_limits pl
    JOIN public.tenants t ON t.plan = pl.plan
    WHERE t.id = p_tenant_id;

  -- Lift product read_only flags
  UPDATE public.products SET read_only = false WHERE tenant_id = p_tenant_id;

  -- Lift member over_limit flags
  UPDATE public.profiles SET over_limit = false WHERE tenant_id = p_tenant_id;

  -- Re-enable webhooks if the new plan allows them
  IF v_webhooks_ok THEN
    UPDATE public.webhook_endpoints SET enabled = true WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

-- ── 10. Widget branding RPC — callable by anon key (SECURITY DEFINER) ─────────
--     Returns whether the widget for a given product should hide the badge.

CREATE OR REPLACE FUNCTION public.get_widget_branding(p_product_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(pl.remove_branding, false)
  FROM   products     p
  JOIN   tenants      t  ON t.id  = p.tenant_id
  JOIN   plan_limits  pl ON pl.plan = t.plan
  WHERE  p.id = p_product_id
  LIMIT  1;
$$;

GRANT EXECUTE ON FUNCTION public.get_widget_branding(uuid) TO anon, authenticated;

-- ── 11. Ensure monthly_usage RLS policy exists (idempotent) ──────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_usage' AND policyname = 'monthly_usage_own_tenant'
  ) THEN
    CREATE POLICY "monthly_usage_own_tenant" ON public.monthly_usage
      FOR ALL TO authenticated
      USING (tenant_id = public.auth_tenant_id());
  END IF;
END $$;

-- ── 12. Update types comment ──────────────────────────────────────────────────

COMMENT ON TABLE  public.plan_limits IS 'Single source of truth for plan feature flags and limits. Prices in EUR cents.';
COMMENT ON COLUMN public.plan_limits.monthly_price_eur IS 'Display price in EUR cents (e.g. 4900 = €49). 0 = free.';
COMMENT ON COLUMN public.plan_limits.annual_price_eur  IS 'Display annual price in EUR cents (e.g. 49000 = €490). 0 = free.';
COMMENT ON COLUMN public.profiles.over_limit           IS 'Set true when workspace downgrades below this member''s seat count. Member can view but not make changes.';
