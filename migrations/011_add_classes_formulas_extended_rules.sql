-- =============================================================================
-- Migration: 011_add_classes_formulas_extended_rules
--
-- Adds three new capabilities:
--   1. Characteristic classes  — named groups for organising characteristics
--   2. Pricing formulas        — JSONB formula ASTs evaluated in the widget
--   3. Extended rule types     — set_value_default and set_value_locked
--   4. Number display_type     — numeric free-input characteristic
-- =============================================================================


-- =============================================================================
-- 1. CHARACTERISTIC CLASSES
-- Tenant-level library, same ownership model as characteristics.
-- =============================================================================

CREATE TABLE public.characteristic_classes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL DEFAULT auth_tenant_id()
                          REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_tenant_id ON public.characteristic_classes(tenant_id);

CREATE TRIGGER characteristic_classes_updated_at
  BEFORE UPDATE ON public.characteristic_classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.characteristic_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characteristic_classes: tenant admin full access"
  ON public.characteristic_classes FOR ALL
  TO authenticated
  USING  (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "characteristic_classes: anon reads via published product"
  ON public.characteristic_classes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM   public.characteristics c
      JOIN   public.product_characteristics pc ON pc.characteristic_id = c.id
      JOIN   public.products p                 ON p.id = pc.product_id
      WHERE  c.class_id = characteristic_classes.id
        AND  p.status = 'published'
    )
  );

-- Link characteristics to classes (optional — NULL = unclassified)
ALTER TABLE public.characteristics
  ADD COLUMN class_id uuid REFERENCES public.characteristic_classes(id) ON DELETE SET NULL;


-- =============================================================================
-- 2. ADD 'number' DISPLAY TYPE
-- Renders as a free numeric input in the widget; the value is used in formulas.
-- =============================================================================

ALTER TABLE public.characteristics
  DROP CONSTRAINT characteristics_display_type_check,
  ADD CONSTRAINT characteristics_display_type_check
    CHECK (display_type IN ('select', 'radio', 'swatch', 'toggle', 'number'));


-- =============================================================================
-- 3. PRICING FORMULAS
-- JSONB stores a FormulaNode AST (see widget/src/types.ts for the full type).
-- Evaluated in the widget to produce a surcharge (+) or discount (−).
-- Multiple formulas per product are summed.
-- =============================================================================

CREATE TABLE public.pricing_formulas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL DEFAULT auth_tenant_id()
                          REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  formula     jsonb       NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_formulas_product_id ON public.pricing_formulas(product_id);
CREATE INDEX idx_formulas_tenant_id  ON public.pricing_formulas(tenant_id);

CREATE TRIGGER pricing_formulas_updated_at
  BEFORE UPDATE ON public.pricing_formulas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.pricing_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_formulas: tenant admin full access"
  ON public.pricing_formulas FOR ALL
  TO authenticated
  USING  (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "pricing_formulas: anon reads published"
  ON public.pricing_formulas FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE  p.id = product_id AND p.status = 'published'
    )
  );


-- =============================================================================
-- 4. EXTENDED RULE TYPES
-- set_value_default : auto-selects a value; customer may override it
-- set_value_locked  : forces a value; widget renders it as read-only
-- Effect JSON shape (same for both): { "characteristic_id": uuid, "value_id": uuid }
-- =============================================================================

ALTER TABLE public.configuration_rules
  DROP CONSTRAINT configuration_rules_rule_type_check,
  ADD CONSTRAINT configuration_rules_rule_type_check
    CHECK (rule_type IN (
      'hide_value', 'disable_value', 'price_override',
      'set_value_default', 'set_value_locked'
    ));
