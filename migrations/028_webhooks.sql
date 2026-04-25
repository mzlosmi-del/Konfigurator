-- Migration 028: Outbound webhooks
-- Tenants can register HTTPS endpoints that receive signed event payloads.

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url         text        NOT NULL CHECK (url LIKE 'https://%'),
  secret      text        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events      text[]      NOT NULL DEFAULT '{}',
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     uuid        NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event           text        NOT NULL,
  payload         jsonb       NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'success', 'failed')),
  http_status     int,
  attempts        int         NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_tenant_idx   ON public.webhook_endpoints (tenant_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON public.webhook_deliveries (endpoint_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_created_idx  ON public.webhook_deliveries (created_at DESC);

-- RLS
ALTER TABLE public.webhook_endpoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints: tenant crud" ON public.webhook_endpoints
  FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "webhook_deliveries: tenant read" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (
    endpoint_id IN (
      SELECT id FROM public.webhook_endpoints
      WHERE tenant_id = auth_tenant_id()
    )
  );
