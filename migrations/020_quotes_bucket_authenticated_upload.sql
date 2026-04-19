-- Migration 020: Allow authenticated users to upload PDFs to the quotes bucket
-- The edge function used service_role; now the admin app uploads client-side.

CREATE POLICY "quotes: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quotes');

CREATE POLICY "quotes: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'quotes');
