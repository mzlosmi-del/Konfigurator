-- Migration 027: Plan limits enforcement
-- DB-level trigger prevents tenants from exceeding product count for their plan.

CREATE OR REPLACE FUNCTION public.check_product_limit()
RETURNS trigger AS $$
DECLARE
  v_plan     text;
  v_count    int;
  v_max      int;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;

  v_max := CASE v_plan
    WHEN 'free'    THEN 3
    WHEN 'starter' THEN 20
    ELSE -1  -- pro = unlimited
  END;

  IF v_max >= 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM public.products
    WHERE tenant_id = NEW.tenant_id;

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: % plan allows % products', v_plan, v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_product_limit ON public.products;
CREATE TRIGGER enforce_product_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_product_limit();
