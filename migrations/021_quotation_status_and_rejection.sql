-- Migration 021: Extended quotation statuses + rejection reasons

-- 1. Create rejection reasons lookup table (must exist before FK)
CREATE TABLE public.quotation_rejection_reasons (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL DEFAULT auth_tenant_id()
                         REFERENCES public.tenants(id) ON DELETE CASCADE,
  label      text        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_rejection_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant isolation"
  ON public.quotation_rejection_reasons
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- 2. Add rejection columns to quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS rejection_reason_id uuid REFERENCES public.quotation_rejection_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_note      text;

-- 3. Migrate existing status values to new slugs
UPDATE public.quotations SET status = 'in_preparation'     WHERE status = 'draft';
UPDATE public.quotations SET status = 'confirmed_sent'      WHERE status = 'sent';
UPDATE public.quotations SET status = 'accepted_no_changes' WHERE status = 'accepted';

-- 4. Replace the CHECK constraint
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_status_check
  CHECK (status IN (
    'in_preparation',
    'confirmed_sent',
    'accepted_no_changes',
    'accepted_with_changes',
    'rejected',
    'expired'
  ));
