-- Migration 072: Split confirmed_sent into confirmed + sent
--
-- Until now, "confirmed_sent" was set the moment the operator clicked
-- "Confirm & Generate PDF" — before any email had actually gone out. That
-- conflated two distinct events: PDF generated, and email delivered. This
-- migration splits them:
--
--   confirmed → PDF has been generated and the public token assigned.
--   sent      → the quotation email has been delivered to the customer.
--
-- Existing rows in `confirmed_sent` are mapped to `sent` per the product
-- decision (assume they were already emailed; the operator workflow
-- before this split was always confirm-then-send).
--
-- The trigger that auto-assigns a `public_token` is moved earlier in the
-- flow — it now fires when status becomes `confirmed`, because the
-- email body links to /q/:token and so the token must exist before the
-- email is sent.

-- 1. Drop CHECK so we can update existing rows.
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;

-- 2. Migrate existing data.
UPDATE public.quotations SET status = 'sent' WHERE status = 'confirmed_sent';

-- 3. Recreate CHECK with the new values; 'confirmed_sent' is gone.
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_status_check
  CHECK (status IN (
    'in_preparation',
    'confirmed',
    'sent',
    'accepted_no_changes',
    'accepted_with_changes',
    'rejected',
    'expired'
  ));

-- 4. Update the token-assign trigger to fire on `confirmed`.
CREATE OR REPLACE FUNCTION public.trg_fn_assign_quotation_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND NEW.public_token IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    NEW.public_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;
