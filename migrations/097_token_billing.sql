-- Migration 097: Token-based billing
--
-- Usage-based billing layered on top of the existing plan tiers. The super-admin
-- assigns a pool of tokens to each tenant; all features are unlocked for everyone
-- (Scale-equivalent) and tokens become the real limit.
--
-- Token costs
--  • Inquiry arrival : 1 token / characteristic of the involved product;
--                      3 tokens if the product has no characteristics (or was deleted).
--  • Quotation issue : 3 tokens / characteristic of every product in the quotation;
--                      10 tokens for any product with no characteristics.
--                      Charged ONCE (re-downloading the same quotation is free).
--
-- Enforcement is DB-authoritative:
--  • Inquiries are inserted directly by the widget (anon) — so deduction/locking is a
--    BEFORE INSERT trigger (mirrors check_inquiry_limit in migration 029). When a tenant
--    is out of tokens the row is still inserted but flagged token_locked (notification
--    only); the existing notify-inquiry email still fires.
--  • Quotations are charged from the admin UI via charge_quotation_tokens() at the
--    moment the quotation first advances past draft (status -> 'confirmed').
--
-- Balances live as columns on tenants (tokens_granted / tokens_spent); the consumption
-- log is an append-only token_ledger table powering the super-admin view.
--
-- Existing tenants are backfilled to 999999 tokens; new signups get the column DEFAULT
-- of 100 (trial).

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tokens_granted bigint NOT NULL DEFAULT 100,   -- new-signup trial
  ADD COLUMN IF NOT EXISTS tokens_spent   bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.token_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  delta         bigint NOT NULL,            -- negative = consume, positive = grant
  reason        text   NOT NULL,            -- 'inquiry' | 'quotation' | 'grant' | 'inquiry_locked'
  ref_type      text,                       -- 'inquiry' | 'quotation' | null
  ref_id        uuid,
  balance_after bigint NOT NULL,            -- remaining after this entry (denormalized for the log)
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_ledger_tenant_created
  ON public.token_ledger(tenant_id, created_at DESC);

ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "token_ledger: own tenant or super admin" ON public.token_ledger;
CREATE POLICY "token_ledger: own tenant or super admin"
  ON public.token_ledger FOR SELECT
  TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());
-- No INSERT policy: only the SECURITY DEFINER functions below write to the ledger.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS token_locked   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tokens_charged int     NOT NULL DEFAULT 0;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS tokens_charged_at timestamptz,            -- NULL = not yet charged (idempotency guard)
  ADD COLUMN IF NOT EXISTS tokens_charged    int NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Cost helpers
-- ---------------------------------------------------------------------------

-- Number of distinct characteristics defined on a product, via the active
-- class model: products -> product_classes -> characteristic_class_members.
CREATE OR REPLACE FUNCTION public.product_characteristic_count(p_product_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(COUNT(DISTINCT ccm.characteristic_id), 0)::int
    FROM public.product_classes pc
    JOIN public.characteristic_class_members ccm ON ccm.class_id = pc.class_id
   WHERE pc.product_id = p_product_id;
$$;

-- Inquiry cost: 1 / characteristic, or 3 if the product has none (or is NULL/deleted).
CREATE OR REPLACE FUNCTION public.token_cost_inquiry(p_product_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN c = 0 THEN 3 ELSE c END
    FROM (SELECT public.product_characteristic_count(p_product_id) AS c) s;
$$;

-- Quotation cost for one product: 3 / characteristic, or 10 if it has none.
CREATE OR REPLACE FUNCTION public.token_cost_quotation_product(p_product_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN c = 0 THEN 10 ELSE c * 3 END
    FROM (SELECT public.product_characteristic_count(p_product_id) AS c) s;
$$;

-- Quotation total: sum over distinct products referenced in line_items.
CREATE OR REPLACE FUNCTION public.token_cost_quotation(p_quotation_id uuid)
RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_pid   uuid;
BEGIN
  FOR v_pid IN
    SELECT DISTINCT (li->>'product_id')::uuid
      FROM public.quotations q,
           jsonb_array_elements(q.line_items) li
     WHERE q.id = p_quotation_id
       AND li->>'product_id' IS NOT NULL
  LOOP
    v_total := v_total + public.token_cost_quotation_product(v_pid);
  END LOOP;
  RETURN v_total;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Inquiry deduction / lock — BEFORE INSERT ON inquiries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charge_inquiry_tokens()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cost      int;
  v_remaining bigint;
BEGIN
  v_cost := public.token_cost_inquiry(NEW.product_id);

  SELECT (tokens_granted - tokens_spent) INTO v_remaining
    FROM public.tenants
   WHERE id = NEW.tenant_id
   FOR UPDATE;

  IF v_remaining IS NULL THEN
    v_remaining := 0;
  END IF;

  IF v_remaining >= v_cost THEN
    UPDATE public.tenants
       SET tokens_spent = tokens_spent + v_cost
     WHERE id = NEW.tenant_id;

    NEW.token_locked   := false;
    NEW.tokens_charged := v_cost;

    INSERT INTO public.token_ledger (tenant_id, delta, reason, ref_type, ref_id, balance_after)
      VALUES (NEW.tenant_id, -v_cost, 'inquiry', 'inquiry', NEW.id, v_remaining - v_cost);
  ELSE
    -- Insufficient balance: row is still inserted (notification only) but locked.
    NEW.token_locked   := true;
    NEW.tokens_charged := 0;

    INSERT INTO public.token_ledger (tenant_id, delta, reason, ref_type, ref_id, balance_after, note)
      VALUES (NEW.tenant_id, 0, 'inquiry_locked', 'inquiry', NEW.id, v_remaining,
              'inquiry locked: needed ' || v_cost || ', had ' || v_remaining);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS charge_inquiry_tokens_trg ON public.inquiries;
CREATE TRIGGER charge_inquiry_tokens_trg
  BEFORE INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.charge_inquiry_tokens();

-- ---------------------------------------------------------------------------
-- 4. Quotation charge (idempotent) + read-only quote
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charge_quotation_tokens(p_quotation_id uuid)
RETURNS TABLE (charged int, remaining bigint, already boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant     uuid;
  v_charged_at timestamptz;
  v_cost       int;
  v_remaining  bigint;
BEGIN
  SELECT tenant_id, tokens_charged_at INTO v_tenant, v_charged_at
    FROM public.quotations
   WHERE id = p_quotation_id
   FOR UPDATE;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'quotation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_tenant <> public.auth_tenant_id() AND NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Already charged: no-op, re-download is free.
  IF v_charged_at IS NOT NULL THEN
    SELECT (tokens_granted - tokens_spent) INTO v_remaining
      FROM public.tenants WHERE id = v_tenant;
    RETURN QUERY SELECT 0, v_remaining, true;
    RETURN;
  END IF;

  v_cost := public.token_cost_quotation(p_quotation_id);

  SELECT (tokens_granted - tokens_spent) INTO v_remaining
    FROM public.tenants WHERE id = v_tenant
   FOR UPDATE;

  IF v_remaining < v_cost THEN
    RAISE EXCEPTION 'insufficient_tokens'
      USING ERRCODE = 'P0001',
            DETAIL  = json_build_object('required', v_cost, 'remaining', v_remaining)::text;
  END IF;

  UPDATE public.tenants
     SET tokens_spent = tokens_spent + v_cost
   WHERE id = v_tenant;

  UPDATE public.quotations
     SET tokens_charged_at = now(),
         tokens_charged    = v_cost
   WHERE id = p_quotation_id;

  INSERT INTO public.token_ledger (tenant_id, delta, reason, ref_type, ref_id, balance_after)
    VALUES (v_tenant, -v_cost, 'quotation', 'quotation', p_quotation_id, v_remaining - v_cost);

  RETURN QUERY SELECT v_cost, v_remaining - v_cost, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_quotation_tokens(uuid) TO authenticated;

-- Read-only: lets the UI gray buttons before attempting a charge.
CREATE OR REPLACE FUNCTION public.quotation_token_quote(p_quotation_id uuid)
RETURNS TABLE (required int, remaining bigint, already_charged boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant
    FROM public.quotations WHERE id = p_quotation_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'quotation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_tenant <> public.auth_tenant_id() AND NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT public.token_cost_quotation(p_quotation_id),
           (SELECT tokens_granted - tokens_spent FROM public.tenants WHERE id = v_tenant),
           (SELECT tokens_charged_at IS NOT NULL FROM public.quotations WHERE id = p_quotation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.quotation_token_quote(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Super-admin RPCs (gated on auth_is_super_admin, migration 069 pattern)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_tokens(
  p_tenant_id uuid,
  p_amount    bigint,
  p_mode      text DEFAULT 'add'
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new_granted bigint;
  v_remaining   bigint;
BEGIN
  IF NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_mode NOT IN ('add', 'set') THEN
    RAISE EXCEPTION 'invalid mode: %', p_mode USING ERRCODE = '22023';
  END IF;

  IF p_mode = 'set' THEN
    UPDATE public.tenants SET tokens_granted = p_amount, updated_at = now()
     WHERE id = p_tenant_id
     RETURNING tokens_granted INTO v_new_granted;
  ELSE
    UPDATE public.tenants SET tokens_granted = tokens_granted + p_amount, updated_at = now()
     WHERE id = p_tenant_id
     RETURNING tokens_granted INTO v_new_granted;
  END IF;

  IF v_new_granted IS NULL THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT tokens_granted - tokens_spent INTO v_remaining
    FROM public.tenants WHERE id = p_tenant_id;

  INSERT INTO public.token_ledger (tenant_id, delta, reason, balance_after, note)
    VALUES (p_tenant_id, p_amount, 'grant', v_remaining, 'admin ' || p_mode);

  RETURN v_remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_tokens(uuid, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_token_ledger(
  p_tenant_id uuid,
  p_limit     int DEFAULT 50
)
RETURNS TABLE (
  id            uuid,
  delta         bigint,
  reason        text,
  ref_type      text,
  ref_id        uuid,
  balance_after bigint,
  note          text,
  created_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT l.id, l.delta, l.reason, l.ref_type, l.ref_id, l.balance_after, l.note, l.created_at
      FROM public.token_ledger l
     WHERE l.tenant_id = p_tenant_id
     ORDER BY l.created_at DESC
     LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_token_ledger(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Extend admin_tenant_overview() with token fields
--    (signature change → drop then recreate)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_tenant_overview();
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
  ai_setup_this_month    int,
  tokens_granted         bigint,
  tokens_spent           bigint,
  tokens_remaining       bigint
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
                 AND m.period_month = date_trunc('month', now())::date), 0) AS ai_setup_this_month,
    t.tokens_granted,
    t.tokens_spent,
    (t.tokens_granted - t.tokens_spent) AS tokens_remaining
  FROM public.tenants t
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_tenant_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Backfill existing tenants to 999999 (new signups keep the DEFAULT 100 trial)
-- ---------------------------------------------------------------------------
UPDATE public.tenants SET tokens_granted = 999999;
