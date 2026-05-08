-- Migration 062: Server-side feature gates + apply_plan_downgrade/upgrade
--
-- Closes audit gaps:
--   • Webhooks not gated server-side (Phase A)
--   • 3D models / AR UI-only — DB inserts ungated (Phase A)
--   • assertFeature inconsistency — DB-level block on the disallowed inserts (Phase A)
--   • Stale plan after downgrade — apply_plan_downgrade/upgrade helpers (Phase C)
--   • Inquiry/product/team quota errors leak raw text to the customer-facing widget;
--     promote them to structured errors with a DETAIL JSON payload (Phase D).

-- ── 0. Shared helper for structured plan/feature errors ──────────────────────

CREATE OR REPLACE FUNCTION public._raise_plan_feature_error(p_feature text, p_plan text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'plan_feature_disabled: %', p_feature
    USING ERRCODE = 'P0001',
          DETAIL  = json_build_object(
            'code',    'PLAN_FEATURE_DISABLED',
            'feature', p_feature,
            'plan',    p_plan
          )::text;
END;
$$;

-- ── 1. webhook_endpoints — gate INSERT on the webhooks feature ───────────────

CREATE OR REPLACE FUNCTION public.check_webhook_endpoint_feature()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan text;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  IF NOT public.tenant_has_feature(NEW.tenant_id, 'webhooks') THEN
    PERFORM public._raise_plan_feature_error('webhooks', COALESCE(v_plan, 'free'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_webhook_endpoint_feature ON public.webhook_endpoints;
CREATE TRIGGER enforce_webhook_endpoint_feature
  BEFORE INSERT ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.check_webhook_endpoint_feature();

-- UPDATE/DELETE pass through so Phase C can flip enabled=false on downgrade
-- without the trigger re-firing.

-- ── 2. visualization_assets — gate INSERT of 3d_model rows on three_d ────────

CREATE OR REPLACE FUNCTION public.check_visualization_3d_feature()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan text;
BEGIN
  IF NEW.asset_type = '3d_model' THEN
    SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
    IF NOT public.tenant_has_feature(NEW.tenant_id, 'three_d') THEN
      PERFORM public._raise_plan_feature_error('three_d', COALESCE(v_plan, 'free'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_visualization_3d_feature ON public.visualization_assets;
CREATE TRIGGER enforce_visualization_3d_feature
  BEFORE INSERT ON public.visualization_assets
  FOR EACH ROW EXECUTE FUNCTION public.check_visualization_3d_feature();

-- Mark-overage column so apply_plan_downgrade can disable existing 3D assets
-- without deleting them.
ALTER TABLE public.visualization_assets
  ADD COLUMN IF NOT EXISTS read_only boolean NOT NULL DEFAULT false;

-- ── 3. products — gate UPDATE OF ar_enabled (false→true) on three_d ──────────

CREATE OR REPLACE FUNCTION public.check_product_ar_enable()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan text;
BEGIN
  IF NEW.ar_enabled IS TRUE AND (OLD.ar_enabled IS DISTINCT FROM TRUE) THEN
    SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
    IF NOT public.tenant_has_feature(NEW.tenant_id, 'three_d') THEN
      PERFORM public._raise_plan_feature_error('three_d', COALESCE(v_plan, 'free'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_ar_enable ON public.products;
CREATE TRIGGER enforce_product_ar_enable
  BEFORE UPDATE OF ar_enabled ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_product_ar_enable();

-- ── 4. Promote existing quota exceptions to structured errors ────────────────
-- Same logic as migration 029, but with a JSON DETAIL payload the client can
-- parse into a friendly message. Backwards-compatible: callers still see the
-- same error text on .message; the new fields land on .details.

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
    SELECT COUNT(*) INTO v_count FROM public.products WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'product_limit_exceeded: % plan allows % products', v_plan, v_max
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object(
                'code',    'PRODUCT_LIMIT_EXCEEDED',
                'plan',    v_plan,
                'limit',   v_max,
                'current', v_count
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
    RAISE EXCEPTION 'inquiry_limit_exceeded: % plan allows % inquiries per month', v_plan, v_max
      USING ERRCODE = 'P0001',
            DETAIL  = json_build_object(
              'code',    'INQUIRY_LIMIT_EXCEEDED',
              'plan',    v_plan,
              'limit',   v_max,
              'current', v_count
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
    RAISE EXCEPTION 'team_limit_exceeded: % plan allows % team members', v_plan, v_max
      USING ERRCODE = 'P0001',
            DETAIL  = json_build_object(
              'code',    'TEAM_LIMIT_EXCEEDED',
              'plan',    v_plan,
              'limit',   v_max,
              'current', v_count
            )::text;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 5. apply_plan_downgrade / apply_plan_upgrade ─────────────────────────────
-- Idempotent. Called from stripe-webhook after every plan change.

CREATE OR REPLACE FUNCTION public.apply_plan_downgrade(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_plan          text;
  v_ai_per_month  int;
BEGIN
  -- 5a. Products read_only — re-uses migration 030 helper.
  PERFORM public.mark_over_limit_products(p_tenant_id);

  -- 5b. Webhooks: if feature off, disable all enabled endpoints.
  IF NOT public.tenant_has_feature(p_tenant_id, 'webhooks') THEN
    UPDATE public.webhook_endpoints
       SET enabled = false
     WHERE tenant_id = p_tenant_id AND enabled = true;
  END IF;

  -- 5c. 3D / AR: if feature off, mark 3d_model assets read-only and turn AR off.
  IF NOT public.tenant_has_feature(p_tenant_id, 'three_d') THEN
    UPDATE public.visualization_assets
       SET read_only = true
     WHERE tenant_id = p_tenant_id
       AND asset_type = '3d_model';
    UPDATE public.products
       SET ar_enabled = false
     WHERE tenant_id = p_tenant_id AND ar_enabled = true;
  END IF;

  -- 5d. AI setup: if feature dropped to zero this month, reset the counter so
  --     a re-upgrade mid-month gives the customer back the full quota.
  SELECT plan INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  SELECT ai_setup_per_month INTO v_ai_per_month
    FROM public.plan_limits WHERE plan = v_plan;
  IF v_ai_per_month = 0 THEN
    UPDATE public.monthly_usage
       SET ai_setup_count = 0
     WHERE tenant_id = p_tenant_id
       AND period_month = date_trunc('month', now())::date;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_plan_upgrade(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Re-mark products (limit may have grown — clears stale read_only flags).
  PERFORM public.mark_over_limit_products(p_tenant_id);

  -- 3D assets: if the feature is back, clear read_only.
  IF public.tenant_has_feature(p_tenant_id, 'three_d') THEN
    UPDATE public.visualization_assets
       SET read_only = false
     WHERE tenant_id = p_tenant_id AND read_only = true;
  END IF;

  -- Webhooks: do NOT auto-re-enable. The tenant must explicitly re-enable
  -- after they confirm their endpoints are still desired (avoids surprise
  -- delivery resumption after long pauses).
END;
$$;
