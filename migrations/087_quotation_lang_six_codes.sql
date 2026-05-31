-- Migration 087: widen quotations.lang to the built-in output language set
--
-- The quotation output (PDF/DOCX/XLSX + email) can now be generated in any of
-- six built-in languages. Migration 068 originally constrained `lang` to
-- ('en','sr'); widen the CHECK to include German, French, Spanish and Russian.
--
-- The default stays 'en' and existing rows (en/sr) remain valid, so no
-- backfill is needed.

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_lang_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_lang_check CHECK (lang IN ('en', 'sr', 'de', 'fr', 'es', 'ru'));
