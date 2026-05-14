-- Adds an optional multilingual description to characteristics.
-- Mirrors the i18n pattern from migration 040.
-- Stored as JSONB: {"en":"...","sr":"..."}. Empty object means no description.

ALTER TABLE characteristics
  ADD COLUMN description_i18n jsonb NOT NULL DEFAULT '{}';
