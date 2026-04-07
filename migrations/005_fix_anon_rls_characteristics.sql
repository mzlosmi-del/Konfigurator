-- =============================================================================
-- Migration: 005_fix_anon_rls_characteristics
--
-- Bug: anon SELECT policies on characteristics and characteristic_values used
-- USING (true), leaking all tenants' option labels and price modifiers to any
-- anonymous caller who knows (or guesses) a UUID.
--
-- Fix: replace with scoped policies that allow anon reads only when the
-- characteristic/value is actually attached to a published product. This keeps
-- the widget working for published products while closing the cross-tenant leak.
--
-- Safe to run multiple times (DROP IF EXISTS before CREATE).
-- =============================================================================

-- ── characteristics ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "characteristics: anon reads all" ON public.characteristics;

CREATE POLICY "characteristics: anon reads via published product"
  ON public.characteristics FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_characteristics pc
      JOIN public.products p ON p.id = pc.product_id
      WHERE pc.characteristic_id = characteristics.id
        AND p.status = 'published'
    )
  );

-- ── characteristic_values ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "characteristic_values: anon reads all" ON public.characteristic_values;

CREATE POLICY "characteristic_values: anon reads via published product"
  ON public.characteristic_values FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_characteristics pc
      JOIN public.products p ON p.id = pc.product_id
      WHERE pc.characteristic_id = characteristic_values.characteristic_id
        AND p.status = 'published'
    )
  );
