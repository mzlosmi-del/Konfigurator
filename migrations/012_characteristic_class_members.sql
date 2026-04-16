-- =============================================================================
-- Migration: 012_characteristic_class_members
--
-- Replaces the one-to-many class_id FK on characteristics with a proper
-- many-to-many junction table so one characteristic can belong to multiple
-- classes and classes remain independent grouping concepts.
-- =============================================================================

CREATE TABLE public.characteristic_class_members (
  class_id          uuid NOT NULL REFERENCES public.characteristic_classes(id) ON DELETE CASCADE,
  characteristic_id uuid NOT NULL REFERENCES public.characteristics(id)        ON DELETE CASCADE,
  sort_order        int  NOT NULL DEFAULT 0,
  PRIMARY KEY (class_id, characteristic_id)
);

CREATE INDEX idx_ccm_class_id ON public.characteristic_class_members(class_id);
CREATE INDEX idx_ccm_char_id  ON public.characteristic_class_members(characteristic_id);

ALTER TABLE public.characteristic_class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccm: tenant admin full access"
  ON public.characteristic_class_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characteristic_classes cc
      WHERE cc.id = class_id AND cc.tenant_id = auth_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characteristic_classes cc
      WHERE cc.id = class_id AND cc.tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "ccm: anon reads via published product"
  ON public.characteristic_class_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_classes pc
      JOIN public.products p ON p.id = pc.product_id
      WHERE pc.class_id = class_id
        AND p.status = 'published'
    )
  );

-- Migrate existing one-to-many data
INSERT INTO public.characteristic_class_members (class_id, characteristic_id)
  SELECT class_id, id FROM public.characteristics WHERE class_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Replace the old policy on characteristic_classes (which referenced
-- characteristics.class_id) with one using the new product_classes path
DROP POLICY IF EXISTS "characteristic_classes: anon reads via published product" ON public.characteristic_classes;

CREATE POLICY "characteristic_classes: anon reads via published product"
  ON public.characteristic_classes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_classes pc
      JOIN public.products p ON p.id = pc.product_id
      WHERE pc.class_id = id
        AND p.status = 'published'
    )
  );

-- Now safe to drop
ALTER TABLE public.characteristics DROP COLUMN IF EXISTS class_id;
