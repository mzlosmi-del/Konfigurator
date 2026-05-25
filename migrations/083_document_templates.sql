-- Migration 083: Customer-customizable document templates.
--
-- A NEW, additive path for producing documents. Each tenant can design a
-- document layout in an in-app visual builder; the layout is stored here as a
-- JSON block tree (`definition`) and rendered client-side to PDF / DOCX / XLSX
-- by the generic renderers in src/lib/docTemplate/. This does NOT replace the
-- existing hardcoded generators — it runs alongside them.
--
-- Block-tree TS types live in src/lib/docTemplate/types.ts and are mirrored by
-- hand into the `// JSONB interfaces` section of src/types/database.ts.
--
-- RLS follows the standard convention: tenant_id = auth_tenant_id() gated by
-- the `settings` functionality (this feature is treated as tenant-wide config).
-- No anonymous policy — templates are only ever read inside the admin panel.

CREATE TABLE IF NOT EXISTS public.document_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  output_kind text        NOT NULL CHECK (output_kind IN ('pdf','docx','xlsx')),
  definition  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_default  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_templates_tenant_idx
  ON public.document_templates (tenant_id, output_kind);

-- Touch updated_at on every write (mirrors tenant_texts_touch_updated_at).
CREATE OR REPLACE FUNCTION public.document_templates_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_templates_touch_updated_at ON public.document_templates;
CREATE TRIGGER document_templates_touch_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.document_templates_touch_updated_at();

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_templates: tenant read"
  ON public.document_templates FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('settings', 'view'));

CREATE POLICY "document_templates: tenant insert"
  ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('settings', 'edit'));

CREATE POLICY "document_templates: tenant update"
  ON public.document_templates FOR UPDATE TO authenticated
  USING      (tenant_id = auth_tenant_id() AND public.auth_can('settings', 'edit'))
  WITH CHECK (tenant_id = auth_tenant_id() AND public.auth_can('settings', 'edit'));

CREATE POLICY "document_templates: tenant delete"
  ON public.document_templates FOR DELETE TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_can('settings', 'edit'));
