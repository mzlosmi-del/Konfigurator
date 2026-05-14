-- Migration 076: Central `tenant_texts` table for unified text maintenance.
--
-- One row per (tenant, level, reference_id, slot, language, sort_order).
-- The combination acts like a SAP BRF+ decision table: each row's condition
-- columns identify a piece of copy, the `content` column holds the text.
--
-- Levels:
--   tenant                 — reference_id IS NULL
--   product                — reference_id = products.id
--   characteristic         — reference_id = characteristics.id
--   characteristic_value   — reference_id = characteristic_values.id
--
-- Slot is an open-ended text label (no CHECK constraint); see the migration
-- 077 backfill for the canonical slot names. Slots that are "multi" (multiple
-- rows per entity, e.g. `terms_line`) use `sort_order` to keep order; for
-- single-row slots `sort_order` stays at 0.
--
-- The `label` column is only used by product custom-text blocks (formerly
-- product_texts.label). For every other slot it stays NULL.

CREATE TABLE IF NOT EXISTS public.tenant_texts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  level         text        NOT NULL CHECK (level IN ('tenant','product','characteristic','characteristic_value')),
  reference_id  uuid,
  slot          text        NOT NULL,
  language      text        NOT NULL CHECK (language IN ('en','sr')),
  sort_order    int         NOT NULL DEFAULT 0,
  label         text,
  content       text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A reference_id must be present for entity-scoped levels and absent for tenant level.
  CONSTRAINT tenant_texts_reference_shape CHECK (
    (level = 'tenant' AND reference_id IS NULL)
    OR (level <> 'tenant' AND reference_id IS NOT NULL)
  )
);

-- Unique key: at most one row per condition tuple. Multi-line slots vary
-- sort_order to keep distinct rows; single-row slots leave sort_order = 0.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_texts_unique_idx
  ON public.tenant_texts (
    tenant_id, level, COALESCE(reference_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slot, language, sort_order
  );

-- Lookup index for renderers: resolve (tenant, level, reference, slot) →
-- ordered rows across both languages.
CREATE INDEX IF NOT EXISTS tenant_texts_resolve_idx
  ON public.tenant_texts (tenant_id, level, reference_id, slot, sort_order);

-- Touch updated_at on every write.
CREATE OR REPLACE FUNCTION public.tenant_texts_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_texts_touch_updated_at ON public.tenant_texts;
CREATE TRIGGER tenant_texts_touch_updated_at
  BEFORE UPDATE ON public.tenant_texts
  FOR EACH ROW EXECUTE FUNCTION public.tenant_texts_touch_updated_at();

ALTER TABLE public.tenant_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_texts: tenant read"
  ON public.tenant_texts FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('texts', 'view'));

CREATE POLICY "tenant_texts: tenant insert"
  ON public.tenant_texts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('texts', 'edit'));

CREATE POLICY "tenant_texts: tenant update"
  ON public.tenant_texts FOR UPDATE TO authenticated
  USING       (tenant_id = auth_tenant_id() AND public.auth_can('texts', 'edit'))
  WITH CHECK  (tenant_id = auth_tenant_id() AND public.auth_can('texts', 'edit'));

CREATE POLICY "tenant_texts: tenant delete"
  ON public.tenant_texts FOR DELETE TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('texts', 'edit'));

-- Anonymous access for the widget / public quotation page. Widgets need to
-- read product/characteristic/value names + descriptions to render in the
-- right language. SELECT only — no INSERT/UPDATE/DELETE allowed.
CREATE POLICY "tenant_texts: anon read"
  ON public.tenant_texts FOR SELECT TO anon
  USING (true);
