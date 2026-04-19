-- 018_product_sku_and_texts.sql
-- Adds SKU (unique identifier) and unit_of_measure to products.
-- Creates product_texts table for named free-text blocks used in PDFs.

-- ── Products: SKU and unit of measure ────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku             text,
  ADD COLUMN IF NOT EXISTS unit_of_measure text;

-- Uniqueness of SKU is scoped per tenant; nulls are exempt (partial index)
CREATE UNIQUE INDEX products_tenant_sku_uniq
  ON public.products (tenant_id, sku)
  WHERE sku IS NOT NULL;

-- ── product_texts ─────────────────────────────────────────────────────────────

CREATE TABLE public.product_texts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL DEFAULT auth_tenant_id()
               REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid        NOT NULL
               REFERENCES public.products(id) ON DELETE CASCADE,
  label      text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  content    text        NOT NULL DEFAULT '',
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_texts_product_id ON public.product_texts (product_id);

ALTER TABLE public.product_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_texts: tenant access"
  ON public.product_texts FOR ALL
  TO authenticated
  USING  (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE TRIGGER product_texts_updated_at
  BEFORE UPDATE ON public.product_texts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
