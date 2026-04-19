-- Migration 019: Company profile fields on tenants + logos storage bucket

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_phone   text,
  ADD COLUMN IF NOT EXISTS company_email   text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS contact_person  text,
  ADD COLUMN IF NOT EXISTS logo_url        text;

-- Public bucket for tenant logos (URL used in PDF generation)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users may manage objects in this bucket
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'logos: authenticated access'
  ) THEN
    CREATE POLICY "logos: authenticated access"
      ON storage.objects FOR ALL
      TO authenticated
      USING  (bucket_id = 'logos')
      WITH CHECK (bucket_id = 'logos');
  END IF;
END $$;
