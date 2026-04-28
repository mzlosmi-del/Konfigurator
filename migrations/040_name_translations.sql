-- Add per-language translation columns to entity name/label fields.
-- Primary columns (name, description, label) remain required fallbacks.
-- i18n columns store optional overrides: {"en":"...","sr":"..."}
-- Widget lookup order: i18n[currentLang] || primaryName

ALTER TABLE products
  ADD COLUMN name_i18n        jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN description_i18n jsonb NOT NULL DEFAULT '{}';

ALTER TABLE characteristics
  ADD COLUMN name_i18n        jsonb NOT NULL DEFAULT '{}';

ALTER TABLE characteristic_classes
  ADD COLUMN name_i18n        jsonb NOT NULL DEFAULT '{}';

ALTER TABLE characteristic_values
  ADD COLUMN label_i18n       jsonb NOT NULL DEFAULT '{}';
