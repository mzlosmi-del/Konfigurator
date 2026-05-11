-- Migration 073: Quotation email attachments
--
-- Adds a `quotation-attachments` storage bucket and a
-- `quotation_attachments` table so operators can attach extra files
-- (specs, brochures, datasheets, …) to a quotation. The files persist on
-- the quotation and are bundled into the customer email by the
-- send-quotation-email Edge Function at send time. A 20MB total cap
-- (PDF + attachments) is enforced both client-side and inside the Edge
-- Function. Per-file cap is also 20MB via the size_bytes CHECK.

-- ── Storage bucket (private; only service role / authenticated within
--    the tenant folder can read or write) ──────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-attachments', 'quotation-attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'quotation-attachments: tenant manage'
  ) THEN
    CREATE POLICY "quotation-attachments: tenant manage"
      ON storage.objects FOR ALL
      TO authenticated
      USING (
        bucket_id = 'quotation-attachments'
        AND (
          (storage.foldername(name))[1] = (
            SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
          )
          OR public.auth_is_super_admin()
        )
      )
      WITH CHECK (
        bucket_id = 'quotation-attachments'
        AND (
          (storage.foldername(name))[1] = (
            SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
          )
          OR public.auth_is_super_admin()
        )
      );
  END IF;
END $$;

-- ── Table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotation_attachments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL DEFAULT auth_tenant_id()
                            REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_id  uuid        NOT NULL
                            REFERENCES public.quotations(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  filename      text        NOT NULL,
  mime_type     text        NOT NULL,
  size_bytes    bigint      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20 * 1024 * 1024),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotation_attachments_quotation_id_idx
  ON public.quotation_attachments (quotation_id);

ALTER TABLE public.quotation_attachments ENABLE ROW LEVEL SECURITY;

-- Read: anyone in the tenant who can view quotations.
-- Write: anyone in the tenant who can edit quotations. Super admin
-- bypasses both via auth_is_super_admin() (migration 069).
CREATE POLICY "quotation_attachments: tenant read"
  ON public.quotation_attachments FOR SELECT
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = auth_tenant_id() AND public.auth_can('quotations', 'view'))
  );

CREATE POLICY "quotation_attachments: tenant write"
  ON public.quotation_attachments FOR ALL
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = auth_tenant_id() AND public.auth_can('quotations', 'edit'))
  )
  WITH CHECK (
    public.auth_is_super_admin()
    OR (tenant_id = auth_tenant_id() AND public.auth_can('quotations', 'edit'))
  );
