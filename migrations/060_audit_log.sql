-- Migration 060: Generic audit log
-- One row per save (or delete) recording only the changed fields as a JSONB diff.
-- Visible to admins only. 90-day retention via pg_cron (or a scheduled function).

CREATE TABLE IF NOT EXISTS public.audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type     text        NOT NULL,
  entity_id       uuid        NOT NULL,
  entity_name     text,
  change_type     text        NOT NULL CHECK (change_type IN ('create','update','delete')),
  changed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  diff            jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_entity_idx
  ON public.audit_log (tenant_id, entity_type, entity_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_tenant_changed_at_idx
  ON public.audit_log (tenant_id, changed_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin (per tenant) can read
CREATE POLICY "audit_log: admin read"
  ON public.audit_log FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() AND public.auth_role() = 'admin');

-- Any authenticated tenant member can insert (so client-side logging works)
CREATE POLICY "audit_log: authenticated insert"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth_tenant_id());

-- 90-day retention (requires pg_cron). If pg_cron is unavailable, run the
-- DELETE manually on a schedule or wire up a Supabase scheduled Edge Function.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-audit-log',
      '0 3 * * *',
      $cron$ DELETE FROM public.audit_log WHERE changed_at < now() - interval '90 days'; $cron$
    );
  END IF;
END $$;
