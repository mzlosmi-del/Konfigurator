-- Migration 098: Super-admin cross-tenant WRITE access
--
-- Background
--  Migration 069 gave the hard-coded super-admin (sales@configureout.com, via
--  auth_is_super_admin()) cross-tenant READ access on the core tables, but
--  deliberately left WRITE paths tenant-locked ("manual edits should go through
--  dedicated RPCs"). The practical effect: the super-admin can SEE another
--  tenant's product in the admin UI but a PATCH returns 406 (the write policy
--  matches 0 rows because tenant_id <> auth_tenant_id()).
--
--  This migration reverses that decision for the authenticated write policies:
--  it adds the same `auth_is_super_admin() OR (<existing predicate>)` escape
--  hatch to every tenant-scoped write policy so the super-admin can edit any
--  tenant's data end-to-end (a product save touches characteristics, classes,
--  rules, formulas, visualization assets and tenant_texts — all must be widened
--  together or saves fail half-way).
--
-- Safety
--  auth_is_super_admin() resolves the email from auth.users (GoTrue-managed,
--  not user-writable via PostgREST), and exactly one account matches, so the
--  hatch cannot be forged by a tenant user.
--
-- Deliberately excluded
--  • role_permissions — per-tenant role/permission matrix stays RPC/owner-only.
--  • audit_log — INSTEAD widened (see below) so god-mode edits ARE audited
--    under the target tenant rather than silently dropped.
--
-- Each policy below is recreated with its ORIGINAL predicate, wrapped in
-- `auth_is_super_admin() OR (...)`. Non-super-admin behaviour is unchanged.

-- ── products + config (the 048 / products-functionality tables) ─────────────
DROP POLICY IF EXISTS "products: authenticated write" ON public.products;
CREATE POLICY "products: authenticated write"
  ON public.products FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('products','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('products','edit')));

DROP POLICY IF EXISTS "characteristics: authenticated write" ON public.characteristics;
CREATE POLICY "characteristics: authenticated write"
  ON public.characteristics FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('products','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('products','edit')));

DROP POLICY IF EXISTS "characteristic_values: authenticated write" ON public.characteristic_values;
CREATE POLICY "characteristic_values: authenticated write"
  ON public.characteristic_values FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('products','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('products','edit')));

DROP POLICY IF EXISTS "characteristic_classes: tenant admin full access" ON public.characteristic_classes;
CREATE POLICY "characteristic_classes: tenant admin full access"
  ON public.characteristic_classes FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "ccm: tenant admin full access" ON public.characteristic_class_members;
CREATE POLICY "ccm: tenant admin full access"
  ON public.characteristic_class_members FOR ALL TO authenticated
  USING (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM characteristic_classes cc
     WHERE cc.id = characteristic_class_members.class_id AND cc.tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM characteristic_classes cc
     WHERE cc.id = characteristic_class_members.class_id AND cc.tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "configuration_rules: tenant admin full access" ON public.configuration_rules;
CREATE POLICY "configuration_rules: tenant admin full access"
  ON public.configuration_rules FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "pricing_formulas: tenant admin full access" ON public.pricing_formulas;
CREATE POLICY "pricing_formulas: tenant admin full access"
  ON public.pricing_formulas FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "product_characteristics: tenant admin via product" ON public.product_characteristics;
CREATE POLICY "product_characteristics: tenant admin via product"
  ON public.product_characteristics FOR ALL TO authenticated
  USING (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM products p
     WHERE p.id = product_characteristics.product_id AND p.tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM products p
     WHERE p.id = product_characteristics.product_id AND p.tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "product_classes: tenant admin full access" ON public.product_classes;
CREATE POLICY "product_classes: tenant admin full access"
  ON public.product_classes FOR ALL TO authenticated
  USING (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM products p
     WHERE p.id = product_classes.product_id AND p.tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM products p
     WHERE p.id = product_classes.product_id AND p.tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "product_characteristic_order: tenant admin full access" ON public.product_characteristic_order;
CREATE POLICY "product_characteristic_order: tenant admin full access"
  ON public.product_characteristic_order FOR ALL TO authenticated
  USING (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM products p
     WHERE p.id = product_characteristic_order.product_id AND p.tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR EXISTS (
    SELECT 1 FROM products p
     WHERE p.id = product_characteristic_order.product_id AND p.tenant_id = auth_tenant_id()));

-- ── visualization ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "visualization_assets: tenant admin full access" ON public.visualization_assets;
CREATE POLICY "visualization_assets: tenant admin full access"
  ON public.visualization_assets FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "visualization_assignments: tenant admin full access" ON public.visualization_assignments;
CREATE POLICY "visualization_assignments: tenant admin full access"
  ON public.visualization_assignments FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "visualization_assignment_conditions: tenant admin full access" ON public.visualization_assignment_conditions;
CREATE POLICY "visualization_assignment_conditions: tenant admin full access"
  ON public.visualization_assignment_conditions FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

-- ── texts (product/characteristic names + labels live here) ──────────────────
DROP POLICY IF EXISTS "tenant_texts: tenant insert" ON public.tenant_texts;
CREATE POLICY "tenant_texts: tenant insert"
  ON public.tenant_texts FOR INSERT TO authenticated
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('texts','edit')));

DROP POLICY IF EXISTS "tenant_texts: tenant update" ON public.tenant_texts;
CREATE POLICY "tenant_texts: tenant update"
  ON public.tenant_texts FOR UPDATE TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('texts','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('texts','edit')));

DROP POLICY IF EXISTS "tenant_texts: tenant delete" ON public.tenant_texts;
CREATE POLICY "tenant_texts: tenant delete"
  ON public.tenant_texts FOR DELETE TO authenticated
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('texts','edit')));

-- ── quotations / inquiries ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "quotations: authenticated write" ON public.quotations;
CREATE POLICY "quotations: authenticated write"
  ON public.quotations FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('quotations','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('quotations','edit')));

DROP POLICY IF EXISTS "inquiries: authenticated write" ON public.inquiries;
CREATE POLICY "inquiries: authenticated write"
  ON public.inquiries FOR UPDATE TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('inquiries','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('inquiries','edit')));

-- ── documents / quotes / misc tenant-scoped tables ───────────────────────────
DROP POLICY IF EXISTS "document_templates: tenant insert" ON public.document_templates;
CREATE POLICY "document_templates: tenant insert"
  ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('settings','edit')));

DROP POLICY IF EXISTS "document_templates: tenant update" ON public.document_templates;
CREATE POLICY "document_templates: tenant update"
  ON public.document_templates FOR UPDATE TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('settings','edit')))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('settings','edit')));

DROP POLICY IF EXISTS "document_templates: tenant delete" ON public.document_templates;
CREATE POLICY "document_templates: tenant delete"
  ON public.document_templates FOR DELETE TO authenticated
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('settings','edit')));

DROP POLICY IF EXISTS "quotes: tenant admin full access" ON public.quotes;
CREATE POLICY "quotes: tenant admin full access"
  ON public.quotes FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "invitations: tenant admin crud" ON public.invitations;
CREATE POLICY "invitations: tenant admin crud"
  ON public.invitations FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "webhook_endpoints: tenant crud" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints: tenant crud"
  ON public.webhook_endpoints FOR ALL TO authenticated
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

-- ── pricing presets / schedules (role = public, no TO clause originally) ──────
DROP POLICY IF EXISTS "tenant_iso_product_adjustment_presets" ON public.product_adjustment_presets;
CREATE POLICY "tenant_iso_product_adjustment_presets"
  ON public.product_adjustment_presets FOR ALL
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "tenant_iso_product_tax_presets" ON public.product_tax_presets;
CREATE POLICY "tenant_iso_product_tax_presets"
  ON public.product_tax_presets FOR ALL
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "tenant_iso_product_price_schedules" ON public.product_price_schedules;
CREATE POLICY "tenant_iso_product_price_schedules"
  ON public.product_price_schedules FOR ALL
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "tenant_iso_characteristic_modifier_schedules" ON public.characteristic_modifier_schedules;
CREATE POLICY "tenant_iso_characteristic_modifier_schedules"
  ON public.characteristic_modifier_schedules FOR ALL
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

DROP POLICY IF EXISTS "tenant isolation" ON public.quotation_rejection_reasons;
CREATE POLICY "tenant isolation"
  ON public.quotation_rejection_reasons FOR ALL
  USING      (auth_is_super_admin() OR (tenant_id = auth_tenant_id()))
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

-- ── audit_log: widen INSERT so god-mode edits are logged under the target tenant
DROP POLICY IF EXISTS "audit_log: authenticated insert" ON public.audit_log;
CREATE POLICY "audit_log: authenticated insert"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth_is_super_admin() OR (tenant_id = auth_tenant_id()));

-- ── SELECT read-back hatches ─────────────────────────────────────────────────
-- supabase-js writes use RETURNING (.select()/.upsert()/.single()), so a write
-- that succeeds still 406s if the row can't be read back. Migration 069 added
-- the super-admin read hatch to products/characteristics/values/inquiries/
-- quotations, but missed these tenant-scoped SELECT policies. Widen them so the
-- super-admin can read back rows it just wrote (and read across tenants
-- consistently). FOR ALL policies already cover SELECT via the USING hatch above.

-- tenant_texts read-back is REQUIRED: product/characteristic names + labels live
-- here, and updateProduct/setEntityI18nText use .select()/.upsert() (RETURNING),
-- which re-reads the row. Without this, saving a product name 406s again.
DROP POLICY IF EXISTS "tenant_texts: tenant read" ON public.tenant_texts;
CREATE POLICY "tenant_texts: tenant read"
  ON public.tenant_texts FOR SELECT TO authenticated
  USING (auth_is_super_admin() OR (tenant_id = auth_tenant_id() AND auth_can('texts','view')));

-- NOTE: other tenant-scoped SELECT policies (document_templates, backfill_log,
-- widget_events, webhook_deliveries) are intentionally NOT widened — they are not
-- needed for the product-edit read-back. role_permissions (read + write) and
-- audit_log admin-read also stay owner/RPC-only.
