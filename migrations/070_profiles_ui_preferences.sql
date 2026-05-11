-- Migration 070: Per-user UI preferences
--
-- Stores per-user table layouts (visible columns, column order, sort) for
-- the list pages (inquiries, quotations, quotations report, …).
--
-- Shape:
--   { "<table_key>": {
--       "columns": [{ "id": "...", "visible": true }, ...],
--       "sortBy":  "created_at" | null,
--       "sortDir": "asc" | "desc"
--     }, ... }
--
-- RLS: the existing "profiles: update own row" policy (migration 026) already
-- allows row owners to update any column on their own profile, so writes
-- from the admin app work without further policy changes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
