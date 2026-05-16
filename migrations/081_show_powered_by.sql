-- Migration 081: Per-tenant "Powered by Configureout" footer toggle
-- Composes with plan_limits.remove_branding so Free/Starter can never hide the footer.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS show_powered_by bool NOT NULL DEFAULT true;

-- Scale tenants default to hidden footer (matches launch spec).
UPDATE public.tenants
   SET show_powered_by = false
 WHERE plan = 'scale';

-- Compose plan AND tenant flag. Returns true when the widget should HIDE the footer.
--   - Free/Starter: plan_limits.remove_branding = false → result is false → widget shows footer.
--   - Growth/Scale: plan allows hiding, but only when tenants.show_powered_by = false.
CREATE OR REPLACE FUNCTION public.get_widget_branding(p_product_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(pl.remove_branding, false)
     AND COALESCE(t.show_powered_by, true) = false
  FROM   products     p
  JOIN   tenants      t  ON t.id   = p.tenant_id
  JOIN   plan_limits  pl ON pl.plan = t.plan
  WHERE  p.id = p_product_id
  LIMIT  1;
$$;

GRANT EXECUTE ON FUNCTION public.get_widget_branding(uuid) TO anon, authenticated;
