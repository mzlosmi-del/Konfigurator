-- Migration 077: Backfill `tenant_texts` from every existing text source.
--
-- Idempotent — uses ON CONFLICT DO NOTHING on the unique index so re-running
-- the migration does not duplicate rows. Existing rows are not modified.
--
-- After this runs, every piece of customer-facing copy that lives in:
--   - products.name_i18n / description_i18n
--   - product_texts (label + content + text_type + language)
--   - characteristics.name_i18n / description_i18n
--   - characteristic_values.label_i18n
--   - tenants.pdf_footer / public_page_title / post_inquiry_message
--   - tenants.quotation_email_intro_i18n / accept_message_i18n / reject_message_i18n
--   - the hardcoded PDF_LABELS.termsLines defaults (8 lines per language)
-- exists as one or more rows in tenant_texts.
--
-- The original columns are left untouched. The renderer migration in a
-- follow-up PR (Phase B) will start reading from tenant_texts with a fallback
-- to the legacy column. Once that is stable, a future migration drops the
-- legacy columns.

-- ── Helper: insert one (lang, content) pair per non-empty JSONB key ──────
-- Inline as a CTE per source rather than a function, to keep this migration
-- a single transactional script that the SQL editor can run.

-- ── 1. Products: name_i18n ───────────────────────────────────────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT p.tenant_id, 'product', p.id, 'name', lang.key, 0, trim(lang.value)
FROM public.products p
CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.name_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

-- Also seed an EN row from the canonical `products.name` (the fallback that
-- existed before name_i18n was introduced) when no i18n entry exists.
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT p.tenant_id, 'product', p.id, 'name', 'en', 0, p.name
FROM public.products p
WHERE p.name IS NOT NULL AND coalesce(p.name, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 2. Products: description_i18n ────────────────────────────────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT p.tenant_id, 'product', p.id, 'description', lang.key, 0, trim(lang.value)
FROM public.products p
CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.description_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

-- Canonical EN fallback from products.description.
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT p.tenant_id, 'product', p.id, 'description', 'en', 0, p.description
FROM public.products p
WHERE p.description IS NOT NULL AND coalesce(p.description, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 3. product_texts (multi-block) ───────────────────────────────────────
-- One product_texts row → one tenant_texts row. text_type becomes the slot
-- so we keep the four buckets (product/specification/note/terms) distinct.
-- Global rows (product_id IS NULL) become tenant-level rows with the same
-- slot name; the central editor can filter them by level=tenant.
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, label, content)
SELECT
  pt.tenant_id,
  CASE WHEN pt.product_id IS NULL THEN 'tenant' ELSE 'product' END AS level,
  pt.product_id AS reference_id,
  pt.text_type  AS slot,
  pt.language,
  pt.sort_order,
  pt.label,
  pt.content
FROM public.product_texts pt
WHERE pt.content IS NOT NULL AND coalesce(pt.content, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 4. Characteristics: name_i18n ────────────────────────────────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT c.tenant_id, 'characteristic', c.id, 'name', lang.key, 0, trim(lang.value)
FROM public.characteristics c
CROSS JOIN LATERAL jsonb_each_text(COALESCE(c.name_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT c.tenant_id, 'characteristic', c.id, 'name', 'en', 0, c.name
FROM public.characteristics c
WHERE coalesce(c.name, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 5. Characteristics: description_i18n ─────────────────────────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT c.tenant_id, 'characteristic', c.id, 'description', lang.key, 0, trim(lang.value)
FROM public.characteristics c
CROSS JOIN LATERAL jsonb_each_text(COALESCE(c.description_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 6. Characteristic values: label_i18n ─────────────────────────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT cv.tenant_id, 'characteristic_value', cv.id, 'label', lang.key, 0, trim(lang.value)
FROM public.characteristic_values cv
CROSS JOIN LATERAL jsonb_each_text(COALESCE(cv.label_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT cv.tenant_id, 'characteristic_value', cv.id, 'label', 'en', 0, cv.label
FROM public.characteristic_values cv
WHERE coalesce(cv.label, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 7. Tenants: scalar text fields → tenant-level rows in EN ────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'pdf_footer', 'en', 0, t.pdf_footer
FROM public.tenants t
WHERE coalesce(t.pdf_footer, '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'public_page_title', 'en', 0, t.public_page_title
FROM public.tenants t
WHERE coalesce(t.public_page_title, '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'post_inquiry_message', 'en', 0, t.post_inquiry_message
FROM public.tenants t
WHERE coalesce(t.post_inquiry_message, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 8. Tenants: JSONB i18n message fields ────────────────────────────────
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'quotation_email_intro', lang.key, 0, trim(lang.value)
FROM public.tenants t
CROSS JOIN LATERAL jsonb_each_text(COALESCE(t.quotation_email_intro_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'quotation_accept_message', lang.key, 0, trim(lang.value)
FROM public.tenants t
CROSS JOIN LATERAL jsonb_each_text(COALESCE(t.quotation_accept_message_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'quotation_reject_message', lang.key, 0, trim(lang.value)
FROM public.tenants t
CROSS JOIN LATERAL jsonb_each_text(COALESCE(t.quotation_reject_message_i18n, '{}'::jsonb)) AS lang(key, value)
WHERE lang.key IN ('en','sr') AND coalesce(lang.value, '') <> ''
ON CONFLICT DO NOTHING;

-- ── 9. Seed terms_line defaults for every tenant ─────────────────────────
-- The PDF templates use a fixed 8-line "Terms & Conditions" block in each
-- language (PDF_LABELS.termsLines in configurator-admin/src/lib/pdf/shared.ts).
-- We materialise those defaults as tenant_texts rows so each tenant can
-- override them in the central editor.
INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'terms_line', 'en', d.idx, d.line
FROM public.tenants t
CROSS JOIN (
  VALUES
    (0, '• Payment: 50% deposit on order confirmation, remaining balance due prior to delivery.'),
    (1, '• Prices are exclusive of VAT and all applicable taxes unless otherwise stated.'),
    (2, '• This quotation is valid for 30 days from the date of issue unless a specific expiry date is noted above.'),
    (3, '• Goods remain the property of the seller until full payment has been received.'),
    (4, '• Delivery timelines are indicative and will be confirmed in writing upon order placement.'),
    (5, '• Any modifications to the agreed order must be requested and confirmed in writing.'),
    (6, '• The seller shall not be liable for delays caused by circumstances beyond its reasonable control.'),
    (7, '• Thank you for your business. We look forward to working with you.')
) AS d(idx, line)
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
SELECT t.id, 'tenant', NULL, 'terms_line', 'sr', d.idx, d.line
FROM public.tenants t
CROSS JOIN (
  VALUES
    (0, '• Plaćanje: 50% avansa pri potvrdi porudžbine, preostali iznos dospeva pre isporuke.'),
    (1, '• Cene ne uključuju PDV i sve primenjive poreze, osim ako nije drugačije naznačeno.'),
    (2, '• Ova ponuda važi 30 dana od datuma izdavanja, osim ako je naznačen konkretan datum važenja.'),
    (3, '• Roba ostaje vlasništvo prodavca sve do trenutka potpune naplate.'),
    (4, '• Rokovi isporuke su okvirni i biće potvrđeni u pisanoj formi pri prihvatanju porudžbine.'),
    (5, '• Svaka izmena dogovorene porudžbine mora biti zatražena i potvrđena u pisanoj formi.'),
    (6, '• Prodavac ne snosi odgovornost za kašnjenja nastala usled okolnosti van njegove razumne kontrole.'),
    (7, '• Hvala na interesovanju. Radujemo se saradnji.')
) AS d(idx, line)
ON CONFLICT DO NOTHING;
