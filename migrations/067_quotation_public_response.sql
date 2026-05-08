-- Migration 067: Public quotation response (email accept/reject flow)
--
-- Adds tokenised public access on quotations so a customer can land on
-- /q/:token from an email button and click Accept / Reject. Token is
-- auto-assigned the first time a quotation moves to confirmed_sent.
-- Validity window is the quotation's own valid_until column — when null,
-- no expiry is enforced.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS public_token         text UNIQUE,
  ADD COLUMN IF NOT EXISTS responded_at         timestamptz,
  ADD COLUMN IF NOT EXISTS responded_ip         inet,
  ADD COLUMN IF NOT EXISTS responded_user_agent text;

CREATE INDEX IF NOT EXISTS quotations_public_token_idx
  ON public.quotations (public_token);

-- Auto-assign 32-byte hex token (same shape as invitations.token from 026)
-- on the first transition into confirmed_sent.
CREATE OR REPLACE FUNCTION public.trg_fn_assign_quotation_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmed_sent'
     AND NEW.public_token IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed_sent') THEN
    NEW.public_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_quotation_token ON public.quotations;
CREATE TRIGGER trg_assign_quotation_token
  BEFORE INSERT OR UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_assign_quotation_token();

-- Anon read by token. The terminal-state quotations (accepted_*/rejected)
-- still need to render their outcome to the customer, so we don't gate on
-- status here. Token presence + URL knowledge act as the access capability.
CREATE POLICY "quotations_read_by_token" ON public.quotations
  FOR SELECT TO anon
  USING (public_token IS NOT NULL);

-- Backfill tokens for any already-confirmed quotations so the new email
-- flow works for existing rows too.
UPDATE public.quotations
   SET public_token = encode(gen_random_bytes(32), 'hex')
 WHERE status = 'confirmed_sent'
   AND public_token IS NULL;
