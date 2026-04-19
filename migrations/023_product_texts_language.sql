-- Add language column to product_texts
-- Indicates which language the text content is written in.
-- Used to filter texts when generating PDFs in a specific language.
ALTER TABLE product_texts
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'sr'));
