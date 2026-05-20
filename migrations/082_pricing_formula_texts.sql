-- Migration 082: make pricing-formula names translatable via tenant_texts.
--
-- Adds 'pricing_formula' as a new level in tenant_texts (reference_id = the
-- pricing_formulas.id, slot = 'name'), mirroring how characteristic / value
-- names are stored. The plain pricing_formulas.name column stays as the
-- canonical/fallback string.
--
-- Idempotent: safe to re-run.

-- ── 1. Extend the level CHECK ────────────────────────────────────────────────
-- Migration 076 declared the CHECK inline, so Postgres auto-named it
-- tenant_texts_level_check. Drop defensively and recreate with the new level.

ALTER TABLE public.tenant_texts DROP CONSTRAINT IF EXISTS tenant_texts_level_check;
ALTER TABLE public.tenant_texts
  ADD CONSTRAINT tenant_texts_level_check
  CHECK (level IN ('tenant','product','characteristic','characteristic_value','pricing_formula'));

-- ── 2. Backfill EN rows from the existing plain names ────────────────────────
-- One English row per formula. SR is left empty — operators add it via the
-- editor; pickTranslation falls back to EN until they do.

-- Guarded with NOT EXISTS rather than ON CONFLICT — the uniqueness is enforced
-- by an expression index (COALESCE on reference_id), which ON CONFLICT can't
-- reliably infer.
INSERT INTO public.tenant_texts
  (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT
  pf.tenant_id, 'pricing_formula', pf.id, 'name', 'en', 0, pf.name
FROM public.pricing_formulas pf
WHERE pf.name IS NOT NULL
  AND length(trim(pf.name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_texts tt
    WHERE tt.tenant_id    = pf.tenant_id
      AND tt.level        = 'pricing_formula'
      AND tt.reference_id = pf.id
      AND tt.slot         = 'name'
      AND tt.language     = 'en'
      AND tt.sort_order   = 0
  );
