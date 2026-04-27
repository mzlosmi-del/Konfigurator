-- Migration 031: Template system
-- Adds is_template/template_category to products, creates a system workspace,
-- and opens an RLS policy so any authenticated user can read templates.

-- ── 1. Extend products table ──────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_template        bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_category  text;

CREATE INDEX IF NOT EXISTS idx_products_is_template ON public.products (is_template)
  WHERE is_template = true;

-- ── 2. System workspace ───────────────────────────────────────────────────────
-- All template products live in this workspace.
-- The nil UUID is a stable, well-known identifier.

INSERT INTO public.tenants (id, name, slug, plan, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System Templates',
  'system-templates',
  'scale',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. RLS: any authenticated user can SELECT templates ──────────────────────

CREATE POLICY "products_read_templates" ON public.products
  FOR SELECT TO authenticated
  USING (is_template = true);

-- ── 4. Characteristics and values in system workspace must also be readable ──

CREATE POLICY "characteristics_read_system" ON public.characteristics
  FOR SELECT TO authenticated
  USING (tenant_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "characteristic_values_read_system" ON public.characteristic_values
  FOR SELECT TO authenticated
  USING (tenant_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "product_characteristics_read_system" ON public.product_characteristics
  FOR SELECT TO authenticated
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  ));

CREATE POLICY "pricing_formulas_read_system" ON public.pricing_formulas
  FOR SELECT TO authenticated
  USING (tenant_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "configuration_rules_read_system" ON public.configuration_rules
  FOR SELECT TO authenticated
  USING (tenant_id = '00000000-0000-0000-0000-000000000000');
