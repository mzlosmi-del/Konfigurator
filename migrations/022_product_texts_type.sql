-- Add text_type column to product_texts
-- Allowed types:
--   product       – printed under the product row in PDF line items
--   specification – also printed in line items, styled as specs
--   note          – rendered as a separate section in the PDF (can be global)
--   terms         – rendered as terms & conditions section (can be global)
ALTER TABLE product_texts
  ADD COLUMN IF NOT EXISTS text_type text NOT NULL DEFAULT 'product'
  CHECK (text_type IN ('product', 'specification', 'note', 'terms'));

-- Allow global texts (not tied to a specific product)
ALTER TABLE product_texts
  ALTER COLUMN product_id DROP NOT NULL;

-- Enforce: product/specification texts must have a product_id
ALTER TABLE product_texts
  DROP CONSTRAINT IF EXISTS product_texts_product_required;

ALTER TABLE product_texts
  ADD CONSTRAINT product_texts_product_required
  CHECK (
    text_type NOT IN ('product', 'specification') OR product_id IS NOT NULL
  );
