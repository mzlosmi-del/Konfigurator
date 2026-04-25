-- Migration 029: Repackage plans from 3 tiers to 4, move limits to a DB table
-- and add monthly_usage tracking + enforcement triggers for all gated dimensions.

-- ── 1. plan_limits table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan                  text PRIMARY KEY,
  products_max          int  NOT NULL DEFAULT -1,   -- -1 = unlimited
  inquiries_per_month   int  NOT NULL DEFAULT -1,
  team_members_max      int  NOT NULL DEFAULT 1,
  three_d               bool NOT NULL DEFAULT false,
  quotations            bool NOT NULL DEFAULT false,
  webhooks              bool NOT NULL DEFAULT false,
  remove_branding       bool NOT NULL DEFAULT false,
  white_label           bool NOT NULL DEFAULT false,
  ai_setup_per_month    int  NOT NULL DEFAULT 0,
  analytics             text NOT NULL DEFAULT 'basic'
                        CHECK (analytics IN ('basic', 'advanced'))
);

-- Authenticated users can read plan limits (needed to render UI)
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_limits_read" ON public.plan_limits
  FOR SELECT TO authenticated USING (true);

-- ── 2. Seed all 4 tiers ───────────────────────────────────────────────────────

INSERT INTO public.plan_limits
  (plan,      products_max, inquiries_per_month, team_members_max, three_d, quotations, webhooks, remove_branding, white_label, ai_setup_per_month, analytics)
VALUES
  ('free',       3,    25,   1, false, false, false, false, false,  0, 'basic'),
  ('starter',   25,   250,   3, true,  true,  false, false, false,  5, 'basic'),
  ('growth',    -1,  2000,  10, true,  true,  true,  true,  false, 50, 'advanced'),
  ('scale',     -1,    -1,  -1, true,  true,  true,  true,  true,  -1, 'advanced')
ON CONFLICT (plan) DO UPDATE SET
  products_max        = EXCLUDED.products_max,
  inquiries_per_month = EXCLUDED.inquiries_per_month,
  team_members_max    = EXCLUDED.team_members_max,
  three_d             = EXCLUDED.three_d,
  quotations          = EXCLUDED.quotations,
  webhooks            = EXCLUDED.webhooks,
  remove_branding     = EXCLUDED.remove_branding,
  white_label         = EXCLUDED.white_label,
  ai_setup_per_month  = EXCLUDED.ai_setup_per_month,
  analytics           = EXCLUDED.analytics;

-- ── 3. Extend tenants.plan CHECK + backfill pro → growth ─────────────────────

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('free', 'starter', 'growth', 'scale'));

UPDATE public.tenants SET plan = 'growth' WHERE plan = 'pro';

-- ── 4. monthly_usage table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.monthly_usage (
  tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month    date    NOT NULL,   -- always first day of month (date_trunc('month', now()))
  inquiries_count int     NOT NULL DEFAULT 0,
  ai_setup_count  int     NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, period_month)
);

ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_usage_own_tenant" ON public.monthly_usage
  FOR ALL TO authenticated
  USING (tenant_id = public.auth_tenant_id());

-- ── 5. Refactor check_product_limit to read from plan_limits ─────────────────

CREATE OR REPLACE FUNCTION public.check_product_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan text;
  v_max  int;
  v_count int;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT products_max INTO v_max FROM public.plan_limits WHERE plan = v_plan;

  IF v_max IS NULL THEN v_max := 3; END IF;  -- safe default

  IF v_max >= 0 THEN
    SELECT COUNT(*) INTO v_count FROM public.products WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: % plan allows % products', v_plan, v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 6. check_inquiry_limit — BEFORE INSERT ON inquiries ──────────────────────

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
    RAISE EXCEPTION 'inquiry_limit_exceeded: % plan allows % inquiries per month', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_inquiry_limit ON public.inquiries;
CREATE TRIGGER enforce_inquiry_limit
  BEFORE INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.check_inquiry_limit();

-- ── 7. increment_inquiry_usage — AFTER INSERT ON inquiries ───────────────────

CREATE OR REPLACE FUNCTION public.increment_inquiry_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.monthly_usage (tenant_id, period_month, inquiries_count)
  VALUES (NEW.tenant_id, date_trunc('month', now())::date, 1)
  ON CONFLICT (tenant_id, period_month)
  DO UPDATE SET inquiries_count = public.monthly_usage.inquiries_count + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_inquiry_usage ON public.inquiries;
CREATE TRIGGER track_inquiry_usage
  AFTER INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.increment_inquiry_usage();

-- ── 8. check_team_limit — BEFORE INSERT ON profiles ──────────────────────────

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
    RAISE EXCEPTION 'team_limit_exceeded: % plan allows % team members', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_team_limit ON public.profiles;
CREATE TRIGGER enforce_team_limit
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_team_limit();

-- ── 9. check_feature_access helper ───────────────────────────────────────────
-- Returns true if the given tenant's plan has the feature enabled.
-- Used by Edge Functions: quotations, webhooks, 3d, etc.

CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_plan text;
  v_result boolean := false;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = p_tenant_id;

  CASE p_feature
    WHEN 'three_d'          THEN SELECT three_d          INTO v_result FROM public.plan_limits WHERE plan = v_plan;
    WHEN 'quotations'       THEN SELECT quotations        INTO v_result FROM public.plan_limits WHERE plan = v_plan;
    WHEN 'webhooks'         THEN SELECT webhooks          INTO v_result FROM public.plan_limits WHERE plan = v_plan;
    WHEN 'remove_branding'  THEN SELECT remove_branding   INTO v_result FROM public.plan_limits WHERE plan = v_plan;
    WHEN 'white_label'      THEN SELECT white_label       INTO v_result FROM public.plan_limits WHERE plan = v_plan;
    ELSE v_result := false;
  END CASE;

  RETURN COALESCE(v_result, false);
END;
$$;
