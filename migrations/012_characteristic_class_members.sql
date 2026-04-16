-- =============================================================================
-- Migration: 012_characteristic_class_members
--
-- Replaces the one-to-many class_id FK on characteristics with a proper
-- many-to-many junction table so one characteristic can belong to multiple
-- classes and classes remain independent grouping concepts.
-- =============================================================================

-- 1. Create junction table
CREATE TABLE public.characteristic_class_members (
  class_id          uuid NOT NULL REFERENCES public.characteristic_classes(id) ON DELETE CASCADE,
  characteristic_id uuid NOT NULL REFERENCES public.characteristics(id)        ON DELETE CASCADE,
  sort_order        int  NOT NULL DEFAULT 0,
  PRIMARY KEY (class_id, characteristic_id)
);

CREATE INDEX idx_ccm_class_id ON public.characteristic_class_members(class_id);
CREATE INDEX idx_ccm_char_id  ON public.characteristic_class_members(characteristic_id);

ALTER TABLE public.characteristic_class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characteristic_class_members: tenant admin full access"
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

CREATE POLICY "characteristic_class_members: anon reads via published product"
  ON public.characteristic_class_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM   public.characteristics c
      JOIN   public.product_characteristics pc ON pc.characteristic_id = c.id
      JOIN   public.products p                 ON p.id = pc.product_id
      WHERE  c.id = characteristic_id
        AND  p.status = 'published'
    )
  );

-- 2. Migrate existing one-to-many data into the junction table
INSERT INTO public.characteristic_class_members (class_id, characteristic_id)
  SELECT class_id, id
  FROM   public.characteristics
  WHERE  class_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the old FK column
ALTER TABLE public.characteristics DROP COLUMN class_id;
