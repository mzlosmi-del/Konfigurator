-- 095_visualization_assignments.sql
-- Ordered per-product lookup table assigning 2D image/render assets to
-- combinations of characteristic values. First matching row (by priority,
-- then id) wins in the widget; an absent condition for a characteristic is a
-- wildcard. See docs/superpowers/specs/2026-06-10-visualization-assignment-table-design.md
-- Scope: image/render assets only. 3D models keep their mesh_rules path.

CREATE TABLE public.visualization_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES public.visualization_assets(id) ON DELETE CASCADE,
  priority    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vassign_product_id ON public.visualization_assignments(product_id);
CREATE INDEX idx_vassign_tenant_id  ON public.visualization_assignments(tenant_id);
CREATE INDEX idx_vassign_asset_id   ON public.visualization_assignments(asset_id);

CREATE TRIGGER visualization_assignments_updated_at
  BEFORE UPDATE ON public.visualization_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.visualization_assignment_conditions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id     uuid NOT NULL REFERENCES public.visualization_assignments(id) ON DELETE CASCADE,
  characteristic_id uuid NOT NULL REFERENCES public.characteristics(id) ON DELETE CASCADE,
  operator          text NOT NULL DEFAULT 'eq' CHECK (operator IN ('eq', 'gt', 'lt')),
  value_id          uuid REFERENCES public.characteristic_values(id) ON DELETE CASCADE,
  numeric_value     numeric,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vcond_assignment_id ON public.visualization_assignment_conditions(assignment_id);
CREATE INDEX idx_vcond_tenant_id     ON public.visualization_assignment_conditions(tenant_id);

-- RLS — mirror visualization_assets exactly.
ALTER TABLE public.visualization_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visualization_assignment_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visualization_assignments: tenant admin full access"
  ON public.visualization_assignments FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "visualization_assignments: anon reads published products"
  ON public.visualization_assignments FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'published'
    )
  );

CREATE POLICY "visualization_assignment_conditions: tenant admin full access"
  ON public.visualization_assignment_conditions FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "visualization_assignment_conditions: anon reads published products"
  ON public.visualization_assignment_conditions FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.visualization_assignments a
      JOIN public.products p ON p.id = a.product_id
      WHERE a.id = assignment_id
        AND p.status = 'published'
    )
  );
