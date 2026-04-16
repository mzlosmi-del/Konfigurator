-- =============================================================================
-- Migration: 015_fix_anon_rls_new_class_model
--
-- Migration 005 created anon RLS policies on characteristics and
-- characteristic_values that referenced the old product_characteristics table.
-- After switching to the product_classes → characteristic_class_members model,
-- those policies always evaluated to false for anon, so the widget received
-- zero characteristics.
--
-- Fix: replace both USING clauses to traverse the new path:
--   characteristic_class_members → product_classes → products (status=published)
-- =============================================================================

-- ── characteristics ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "characteristics: anon reads via published product" ON public.characteristics;

CREATE POLICY "characteristics: anon reads via published product"
  ON public.characteristics FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM   public.characteristic_class_members ccm
      JOIN   public.product_classes              pc  ON pc.class_id   = ccm.class_id
      JOIN   public.products                     p   ON p.id          = pc.product_id
      WHERE  ccm.characteristic_id = characteristics.id
        AND  p.status = 'published'
    )
  );

-- ── characteristic_values ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "characteristic_values: anon reads via published product" ON public.characteristic_values;

CREATE POLICY "characteristic_values: anon reads via published product"
  ON public.characteristic_values FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM   public.characteristic_class_members ccm
      JOIN   public.product_classes              pc  ON pc.class_id   = ccm.class_id
      JOIN   public.products                     p   ON p.id          = pc.product_id
      WHERE  ccm.characteristic_id = characteristic_values.characteristic_id
        AND  p.status = 'published'
    )
  );
