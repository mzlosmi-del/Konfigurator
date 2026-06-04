-- =============================================================================
-- Migration: 089_product_characteristic_order
--
-- Per-product override for the display order of characteristics in the widget.
--
-- The widget renders characteristics as a flat list. Their order is normally
-- derived from the class structure (product_classes.sort_order, then
-- characteristic_class_members.sort_order within each class). This table lets a
-- merchant pin an explicit flat order per product that overrides that default.
--
-- A row exists only for characteristics the merchant has explicitly ordered;
-- characteristics with no row fall back to the class-derived order (sorted
-- after the explicitly-ordered ones). So existing products render unchanged
-- until a merchant reorders.
--
-- RLS mirrors product_classes (013): no tenant_id column; access is gated
-- through the parent product's tenant_id, and anon may read for published
-- products (so the public widget can fetch the order).
-- =============================================================================

CREATE TABLE public.product_characteristic_order (
  product_id        uuid NOT NULL REFERENCES public.products(id)         ON DELETE CASCADE,
  characteristic_id uuid NOT NULL REFERENCES public.characteristics(id)  ON DELETE CASCADE,
  sort_order        int  NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, characteristic_id)
);

CREATE INDEX idx_product_characteristic_order_product
  ON public.product_characteristic_order(product_id, sort_order);

ALTER TABLE public.product_characteristic_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_characteristic_order: tenant admin full access"
  ON public.product_characteristic_order FOR ALL
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

CREATE POLICY "product_characteristic_order: anon reads published"
  ON public.product_characteristic_order FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.status = 'published'
    )
  );
