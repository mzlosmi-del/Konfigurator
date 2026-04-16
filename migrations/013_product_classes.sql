-- =============================================================================
-- Migration: 013_product_classes
--
-- Products are now assigned classes. A product's configurable characteristics
-- come from the union of characteristics across all its assigned classes.
-- Replaces the product_characteristics direct join with:
--   product → product_classes → characteristic_class_members → characteristics
-- =============================================================================

CREATE TABLE public.product_classes (
  product_id uuid NOT NULL REFERENCES public.products(id)            ON DELETE CASCADE,
  class_id   uuid NOT NULL REFERENCES public.characteristic_classes(id) ON DELETE CASCADE,
  sort_order int  NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, class_id)
);

CREATE INDEX idx_product_classes_product_id ON public.product_classes(product_id);
CREATE INDEX idx_product_classes_class_id   ON public.product_classes(class_id);

ALTER TABLE public.product_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_classes: tenant admin full access"
  ON public.product_classes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.tenant_id = auth_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "product_classes: anon reads published"
  ON public.product_classes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.status = 'published'
    )
  );
