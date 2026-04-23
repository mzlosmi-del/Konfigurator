-- Migration 025: product-assets storage bucket for product visualization images
-- Path pattern: <tenant_id>/<product_id>/<timestamp>.<ext>

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-assets', 'product-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can manage objects in their own tenant's folder only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product-assets: tenant manage'
  ) THEN
    CREATE POLICY "product-assets: tenant manage"
      ON storage.objects FOR ALL
      TO authenticated
      USING (
        bucket_id = 'product-assets'
        AND (storage.foldername(name))[1] = (
          SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        bucket_id = 'product-assets'
        AND (storage.foldername(name))[1] = (
          SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
