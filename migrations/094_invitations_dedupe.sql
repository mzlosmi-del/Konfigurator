-- Migration 094: Prevent duplicate team invitations
--
-- Background: send-invite only checked the profiles table for "already a member",
-- not the invitations table, and there was no DB-level guard. This allowed the same
-- email to receive multiple pending invitations for one tenant; when each was
-- accepted, the invitations table ended up with several accepted rows for one person,
-- inflating any invitation-based member count.
--
-- This migration:
--   1. Removes any pre-existing duplicate *pending* invitations (keeps the earliest
--      per tenant+email) so the unique index can be created.
--   2. Adds a partial unique index that forbids more than one PENDING invitation per
--      (tenant_id, lower(email)). Accepted invitations are historical and excluded,
--      so a user who later leaves can still be re-invited.
--
-- Note: a duplicate ACCEPTED invitation for tenant a1000000-…-0001
-- (milos@investirajpametno.rs) was already removed manually before this migration.

-- 1. Drop duplicate pending invitations, keeping the earliest per tenant + lowercased email.
DELETE FROM public.invitations i
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id, lower(email)
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.invitations
  WHERE accepted_at IS NULL
) dups
WHERE i.id = dups.id
  AND dups.rn > 1;

-- 2. Enforce uniqueness on pending invitations only.
CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_tenant_email_uniq
  ON public.invitations (tenant_id, lower(email))
  WHERE accepted_at IS NULL;
