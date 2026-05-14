-- Migration 078: Drop the legacy text storage columns now that every reader
-- (PDF / DOCX / XLSX renderers, email Edge Function, public quotation page,
-- widget) and every writer (Library, Edit Product, Settings, Characteristic
-- values editor, Central Texts page) goes through `tenant_texts` (migration
-- 076). The data has been mirrored into tenant_texts by migration 077 and
-- maintained there by Phase C of the application code.
--
-- After this migration:
--   - `products.name_i18n` and `description_i18n` are gone. Use
--     tenant_texts where (level='product', reference_id=product.id,
--     slot='name'|'description').
--   - `characteristics.name_i18n` and `description_i18n` are gone.
--   - `characteristic_values.label_i18n` is gone.
--   - `tenants.pdf_footer`, `public_page_title`, `post_inquiry_message`
--     are gone. Use tenant_texts at level='tenant'.
--   - `tenants.quotation_email_intro_i18n`, `quotation_accept_message_i18n`,
--     `quotation_reject_message_i18n` are gone.
--   - `product_texts` table is gone (its content moved to tenant_texts
--     rows with slot in product/specification/note/terms).
--
-- The canonical scalar columns (`products.name`, `products.description`,
-- `characteristics.name`, `characteristic_values.label`) are NOT dropped —
-- they remain as the identifier-style fields used by list views, ORDER BY
-- clauses and the widget's fallback path. Likewise we keep
-- `characteristic_classes.name_i18n` because no readers/writers were
-- migrated for it in this rollout.

BEGIN;

-- ── 1. Drop product i18n JSONB ───────────────────────────────────────────
ALTER TABLE public.products
  DROP COLUMN IF EXISTS name_i18n,
  DROP COLUMN IF EXISTS description_i18n;

-- ── 2. Drop characteristic i18n JSONB ────────────────────────────────────
ALTER TABLE public.characteristics
  DROP COLUMN IF EXISTS name_i18n,
  DROP COLUMN IF EXISTS description_i18n;

-- ── 3. Drop characteristic value i18n JSONB ──────────────────────────────
ALTER TABLE public.characteristic_values
  DROP COLUMN IF EXISTS label_i18n;

-- ── 4. Drop tenant scalar text fields ────────────────────────────────────
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS pdf_footer,
  DROP COLUMN IF EXISTS public_page_title,
  DROP COLUMN IF EXISTS post_inquiry_message;

-- ── 5. Drop tenant i18n message JSONB ────────────────────────────────────
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS quotation_email_intro_i18n,
  DROP COLUMN IF EXISTS quotation_accept_message_i18n,
  DROP COLUMN IF EXISTS quotation_reject_message_i18n;

-- ── 6. Drop the product_texts table entirely ─────────────────────────────
-- All rows have been migrated into tenant_texts by migration 077. The
-- renderer no longer reads from this table and the central editor manages
-- the equivalent rows directly.
DROP TABLE IF EXISTS public.product_texts CASCADE;

COMMIT;
