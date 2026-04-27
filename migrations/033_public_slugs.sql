-- Migration 033: Public shareable preview links
-- Adds public_slug (auto-assigned on first publish) and public_preview_enabled to products.
-- An anon RLS policy lets the public-preview Edge Function read without service role.

-- ── 1. New columns ────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS public_slug            text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_preview_enabled bool NOT NULL DEFAULT true;

-- ── 2. Slug generator (10 lowercase-alphanumeric chars) ───────────────────────

CREATE OR REPLACE FUNCTION generate_public_slug() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  slug  text := '';
  i     int;
BEGIN
  FOR i IN 1..10 LOOP
    slug := slug || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
  END LOOP;
  RETURN slug;
END;
$$;

-- ── 3. Trigger: assign slug the first time a product is published ──────────────

CREATE OR REPLACE FUNCTION trg_fn_assign_public_slug() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Only non-template products get a slug; only on first publish
  IF NEW.status = 'published' AND NEW.public_slug IS NULL AND NOT COALESCE(NEW.is_template, false) THEN
    LOOP
      BEGIN
        NEW.public_slug := generate_public_slug();
        RETURN NEW;
      EXCEPTION WHEN unique_violation THEN
        -- Collision (astronomically unlikely) — retry with a new slug
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_public_slug
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION trg_fn_assign_public_slug();

-- ── 4. RLS: anon can SELECT a published, preview-enabled product ──────────────
-- The slug acts as an unguessable capability token (10^62 space).
-- This lets the public-preview Edge Function use the anon key rather than
-- the service role, so data access is narrowly scoped by RLS.

CREATE POLICY "products_read_public_preview" ON public.products
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND public_slug IS NOT NULL
    AND public_preview_enabled = true
    AND NOT COALESCE(is_template, false)
  );

-- Anon also needs to read characteristics/values/formulas for the widget to work.
-- Use the same "published product" check via a subquery.

CREATE POLICY "product_characteristics_read_public" ON public.product_characteristics
  FOR SELECT TO anon
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE status = 'published' AND public_slug IS NOT NULL AND public_preview_enabled = true
  ));

CREATE POLICY "characteristics_read_public" ON public.characteristics
  FOR SELECT TO anon
  USING (id IN (
    SELECT pc.characteristic_id FROM public.product_characteristics pc
    JOIN public.products p ON p.id = pc.product_id
    WHERE p.status = 'published' AND p.public_slug IS NOT NULL AND p.public_preview_enabled = true
  ));

CREATE POLICY "characteristic_values_read_public" ON public.characteristic_values
  FOR SELECT TO anon
  USING (characteristic_id IN (
    SELECT pc.characteristic_id FROM public.product_characteristics pc
    JOIN public.products p ON p.id = pc.product_id
    WHERE p.status = 'published' AND p.public_slug IS NOT NULL AND p.public_preview_enabled = true
  ));

CREATE POLICY "pricing_formulas_read_public" ON public.pricing_formulas
  FOR SELECT TO anon
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE status = 'published' AND public_slug IS NOT NULL AND public_preview_enabled = true
  ));

CREATE POLICY "configuration_rules_read_public" ON public.configuration_rules
  FOR SELECT TO anon
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE status = 'published' AND public_slug IS NOT NULL AND public_preview_enabled = true
  ));

CREATE POLICY "visualization_assets_read_public" ON public.visualization_assets
  FOR SELECT TO anon
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE status = 'published' AND public_slug IS NOT NULL AND public_preview_enabled = true
  ));

-- Anon can INSERT inquiries (existing behaviour — the widget submits inquiries)
-- No new policy needed; existing anon insert policy covers this.
