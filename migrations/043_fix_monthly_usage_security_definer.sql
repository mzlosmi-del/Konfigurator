-- Fix RLS violation when widget (anon role) submits an inquiry.
-- The trigger functions that read/write monthly_usage were created without
-- SECURITY DEFINER, so they ran as the invoking role (anon) which has no
-- permission on monthly_usage (policy is restricted to `authenticated`).
-- Adding SECURITY DEFINER makes them run as the function owner (postgres),
-- bypassing RLS the same way other system trigger functions do.

CREATE OR REPLACE FUNCTION public.check_inquiry_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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

CREATE OR REPLACE FUNCTION public.increment_inquiry_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.monthly_usage (tenant_id, period_month, inquiries_count)
  VALUES (NEW.tenant_id, date_trunc('month', now())::date, 1)
  ON CONFLICT (tenant_id, period_month)
  DO UPDATE SET inquiries_count = public.monthly_usage.inquiries_count + 1;
  RETURN NEW;
END;
$$;
