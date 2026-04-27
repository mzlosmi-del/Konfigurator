-- Migration 034: Add characteristic classes to template products
-- Migration 031 (templates) and 032 (seeds) omitted the class layer that
-- the admin editor requires for displaying characteristics.
-- This migration:
--   1. Adds missing RLS policies so authenticated users can read system-workspace classes
--   2. Creates one characteristic class per template (all chars in one group)
--   3. Wires product_classes + characteristic_class_members

-- ── 1. RLS: authenticated reads for system-workspace class tables ──────────────
-- (these were accidentally omitted from 031_templates.sql)

CREATE POLICY "characteristic_classes_read_system" ON public.characteristic_classes
  FOR SELECT TO authenticated
  USING (tenant_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "characteristic_class_members_read_system" ON public.characteristic_class_members
  FOR SELECT TO authenticated
  USING (class_id IN (
    SELECT id FROM public.characteristic_classes
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  ));

CREATE POLICY "product_classes_read_system" ON public.product_classes
  FOR SELECT TO authenticated
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  ));

-- ── 2. RLS: anon reads for public-preview (widget needs classes to render) ─────
-- These complement the anon policies added in 033_public_slugs.sql.

CREATE POLICY "characteristic_classes_read_public" ON public.characteristic_classes
  FOR SELECT TO anon
  USING (id IN (
    SELECT pc.class_id FROM public.product_classes pc
    JOIN public.products p ON p.id = pc.product_id
    WHERE p.status = 'published'
      AND p.public_slug IS NOT NULL
      AND p.public_preview_enabled = true
  ));

CREATE POLICY "characteristic_class_members_read_public" ON public.characteristic_class_members
  FOR SELECT TO anon
  USING (class_id IN (
    SELECT pc.class_id FROM public.product_classes pc
    JOIN public.products p ON p.id = pc.product_id
    WHERE p.status = 'published'
      AND p.public_slug IS NOT NULL
      AND p.public_preview_enabled = true
  ));

CREATE POLICY "product_classes_read_public" ON public.product_classes
  FOR SELECT TO anon
  USING (product_id IN (
    SELECT id FROM public.products
    WHERE status = 'published'
      AND public_slug IS NOT NULL
      AND public_preview_enabled = true
  ));

-- ── 3. Create one class per template product and wire up memberships ───────────

DO $$
DECLARE
  sys_tid  uuid := '00000000-0000-0000-0000-000000000000';
  prod     record;
  class_id uuid;
BEGIN
  FOR prod IN
    SELECT id, name
    FROM public.products
    WHERE tenant_id = sys_tid
      AND is_template = true
    ORDER BY template_category, name
  LOOP
    -- Create a class named after the product (one class groups all its options)
    INSERT INTO public.characteristic_classes (tenant_id, name, sort_order)
    VALUES (sys_tid, prod.name, 0)
    RETURNING id INTO class_id;

    -- Add every characteristic linked via product_characteristics as a class member
    INSERT INTO public.characteristic_class_members (class_id, characteristic_id, sort_order)
    SELECT class_id, pc.characteristic_id, pc.sort_order
    FROM public.product_characteristics pc
    WHERE pc.product_id = prod.id
    ORDER BY pc.sort_order;

    -- Link the product to this class
    INSERT INTO public.product_classes (product_id, class_id, sort_order)
    VALUES (prod.id, class_id, 0);
  END LOOP;
END $$;
