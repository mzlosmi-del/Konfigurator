-- Migration 065: Public-page branding (white-label F3)
--
-- A scale-tier tenant can replace the favicon and browser-tab title shown
-- on customer-facing public pages (/p/:slug today, /q/:token in the future)
-- with their own branding.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS favicon_url        text,
  ADD COLUMN IF NOT EXISTS public_page_title  text;
