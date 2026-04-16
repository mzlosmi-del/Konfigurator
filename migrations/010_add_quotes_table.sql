-- =============================================================================
-- Migration: 010_add_quotes_table
-- Adds CPQ quote tracking: every PDF quote generated from an inquiry is stored
-- here so admins can see quote history and customers receive a formal document.
-- =============================================================================

CREATE TABLE public.quotes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid        NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL DEFAULT auth_tenant_id()
                          REFERENCES public.tenants(id) ON DELETE CASCADE,
  pdf_url     text,                        -- public storage URL of the generated PDF
  expires_at  timestamptz,                 -- NULL = no expiry
  status      text        NOT NULL DEFAULT 'sent'
                          CHECK (status IN ('sent', 'expired')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_inquiry_id ON public.quotes(inquiry_id);
CREATE INDEX idx_quotes_tenant_id  ON public.quotes(tenant_id);

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes: tenant admin full access"
  ON public.quotes FOR ALL
  TO authenticated
  USING  (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── Storage bucket for quote PDFs ─────────────────────────────────────────────
-- Public bucket: URLs are scoped to UUID paths, making them effectively
-- unguessable. No sensitive PII beyond what's in the inquiry itself.

INSERT INTO storage.buckets (id, name, public)
VALUES ('quotes', 'quotes', true)
ON CONFLICT (id) DO NOTHING;

-- Only the Edge Function (service_role) may upload PDFs
CREATE POLICY "quotes storage: service role insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'quotes');

-- Authenticated admins may read (e.g. re-download from the admin UI)
CREATE POLICY "quotes storage: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'quotes');
