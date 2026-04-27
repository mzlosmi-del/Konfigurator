-- Migration 030: Stripe billing columns, processed_events idempotency table,
-- and downgrade-with-overage helper.

-- ── 1. Stripe columns on tenants ─────────────────────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS subscription_status     text
    CHECK (subscription_status IN (
      'active','trialing','past_due','canceled','unpaid','paused'
    )),
  ADD COLUMN IF NOT EXISTS grace_period_ends_at    timestamptz;

-- ── 2. processed_events — webhook idempotency ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.processed_events (
  stripe_event_id text        PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Only service-role can insert (done inside the webhook Edge Function).
-- No RLS needed — not accessed by the client.

-- ── 3. mark_over_limit_resources helper ─────────────────────────────────────
-- Adds a read_only flag to products so the app can surface "over limit" banners
-- without deleting any data.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS read_only bool NOT NULL DEFAULT false;

-- Function: called by stripe-webhook after a downgrade to free.
-- Marks excess products read_only (keeps the first N by created_at).
CREATE OR REPLACE FUNCTION public.mark_over_limit_products(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_plan text;
  v_max  int;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  SELECT products_max INTO v_max FROM public.plan_limits WHERE plan = v_plan;

  IF v_max < 0 THEN RETURN; END IF;  -- unlimited, nothing to do

  -- Reset all first, then re-mark excess
  UPDATE public.products SET read_only = false WHERE tenant_id = p_tenant_id;

  UPDATE public.products SET read_only = true
  WHERE tenant_id = p_tenant_id
    AND id NOT IN (
      SELECT id FROM public.products
      WHERE tenant_id = p_tenant_id
      ORDER BY created_at ASC
      LIMIT v_max
    );
END;
$$;
