-- Migration 093: Customer inquiry image attachments
--
-- Lets a customer attach reference images to an inquiry from the widget when
-- the product has `uploads_possible = true` (migration 092). Mirrors the
-- quotation-attachments design (migration 073) but for the *anonymous* widget
-- visitor: the widget uses the anon key, so anon must be able to INSERT both
-- the storage object and the metadata row — but never read, update or delete.
--
-- The widget generates the inquiry id client-side and inserts it on the
-- inquiry row, then uploads each file to `${tenant_id}/${inquiry_id}/${uuid}`
-- and inserts a matching `inquiry_attachments` row. The anon INSERT policy
-- re-checks, server-side, that the inquiry belongs to a published product in
-- the same tenant whose `uploads_possible` flag is on, and the 20 MB / file
-- cap is enforced by the size_bytes CHECK. Companies download the files from
-- the admin Inquiry detail page and the notification email via signed URLs
-- (the bucket is private).

-- ── Storage bucket (private) ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquiry-attachments', 'inquiry-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated tenant members manage files inside their own tenant folder
-- (download / delete from the admin). Mirrors the quotation-attachments
-- storage policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'inquiry-attachments: tenant manage'
  ) THEN
    CREATE POLICY "inquiry-attachments: tenant manage"
      ON storage.objects FOR ALL
      TO authenticated
      USING (
        bucket_id = 'inquiry-attachments'
        AND (
          (storage.foldername(name))[1] = (
            SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
          )
          OR public.auth_is_super_admin()
        )
      )
      WITH CHECK (
        bucket_id = 'inquiry-attachments'
        AND (
          (storage.foldername(name))[1] = (
            SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
          )
          OR public.auth_is_super_admin()
        )
      );
  END IF;
END $$;

-- Anonymous widget visitor: INSERT only, and only into a folder whose first
-- segment is a real tenant id. No anon read/update/delete. The tenant the
-- object claims to belong to must exist; the table-level policy below does the
-- heavier "published product + uploads enabled" check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'inquiry-attachments: anon insert'
  ) THEN
    CREATE POLICY "inquiry-attachments: anon insert"
      ON storage.objects FOR INSERT
      TO anon
      WITH CHECK (
        bucket_id = 'inquiry-attachments'
        AND EXISTS (
          SELECT 1 FROM public.tenants tnt
          WHERE tnt.id::text = (storage.foldername(name))[1]
        )
      );
  END IF;
END $$;

-- ── Table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inquiry_attachments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL
                            REFERENCES public.tenants(id) ON DELETE CASCADE,
  inquiry_id    uuid        NOT NULL
                            REFERENCES public.inquiries(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  filename      text        NOT NULL,
  mime_type     text        NOT NULL,
  size_bytes    bigint      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20 * 1024 * 1024),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiry_attachments_inquiry_id_idx
  ON public.inquiry_attachments (inquiry_id);

ALTER TABLE public.inquiry_attachments ENABLE ROW LEVEL SECURITY;

-- Authenticated: read gated on `inquiries` view, write/delete on edit.
-- Super admin bypasses both via auth_is_super_admin().
CREATE POLICY "inquiry_attachments: tenant read"
  ON public.inquiry_attachments FOR SELECT
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = auth_tenant_id() AND public.auth_can('inquiries', 'view'))
  );

CREATE POLICY "inquiry_attachments: tenant write"
  ON public.inquiry_attachments FOR ALL
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR (tenant_id = auth_tenant_id() AND public.auth_can('inquiries', 'edit'))
  )
  WITH CHECK (
    public.auth_is_super_admin()
    OR (tenant_id = auth_tenant_id() AND public.auth_can('inquiries', 'edit'))
  );

-- Anon widget visitor: INSERT only. No SELECT. The referenced inquiry must
-- belong to a published product in the same tenant whose uploads are enabled.
--
-- The check is delegated to a SECURITY DEFINER helper because the predicate
-- has to read `public.inquiries`, and anon has no SELECT *policy* on that table
-- ("INSERT only, no SELECT"). Evaluating the EXISTS inline would run under the
-- anon role's RLS and always see zero inquiry rows, so the check would always
-- fail. The helper runs as its owner (bypassing RLS) while still enforcing
-- every condition. Mirrors the existing auth_*() SECURITY DEFINER helpers.
CREATE OR REPLACE FUNCTION public.inquiry_allows_upload(p_inquiry_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.inquiries i
    JOIN public.products  p ON p.id = i.product_id
    WHERE i.id = p_inquiry_id
      AND i.tenant_id = p_tenant_id
      AND p.tenant_id = p_tenant_id
      AND p.status = 'published'
      AND p.uploads_possible = true
  );
$$;

-- Only anon needs to call it (the table policy below). Lock down EXECUTE.
REVOKE ALL ON FUNCTION public.inquiry_allows_upload(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inquiry_allows_upload(uuid, uuid) TO anon;

CREATE POLICY "inquiry_attachments: anon insert only"
  ON public.inquiry_attachments FOR INSERT
  TO anon
  WITH CHECK (
    public.inquiry_allows_upload(inquiry_attachments.inquiry_id, inquiry_attachments.tenant_id)
  );
