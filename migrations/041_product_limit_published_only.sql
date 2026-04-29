-- Fix check_product_limit to count only published, non-template products.
-- Templates (is_template = true) and drafts are free to create without limit.
-- Also fires on UPDATE so publishing a draft is checked too.

CREATE OR REPLACE FUNCTION public.check_product_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_plan  text;
  v_max   int;
  v_count int;
BEGIN
  -- Skip limit check for template products
  IF NEW.is_template = true THEN RETURN NEW; END IF;

  -- On UPDATE: only re-check when status is changing TO published
  IF TG_OP = 'UPDATE' AND (OLD.status = 'published' OR NEW.status <> 'published') THEN
    RETURN NEW;
  END IF;

  -- On INSERT: skip if not being inserted as published
  IF TG_OP = 'INSERT' AND NEW.status <> 'published' THEN RETURN NEW; END IF;

  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT products_max INTO v_max FROM public.plan_limits WHERE plan = v_plan;

  IF v_max IS NULL THEN v_max := 3; END IF;  -- safe default

  IF v_max >= 0 THEN
    SELECT COUNT(*) INTO v_count
      FROM public.products
     WHERE tenant_id   = NEW.tenant_id
       AND status      = 'published'
       AND is_template = false
       AND id         <> NEW.id;   -- exclude the row being updated/inserted
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: % plan allows % published products', v_plan, v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create trigger to also fire on UPDATE OF status
DROP TRIGGER IF EXISTS enforce_product_limit ON public.products;
CREATE TRIGGER enforce_product_limit
  BEFORE INSERT OR UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_product_limit();
