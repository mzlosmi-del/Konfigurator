-- Migration 035: Analytics — widget_events table
-- Stores lightweight behavioural events emitted by the configurator widget.
-- Inserts are made exclusively by the ingest-events Edge Function (service role),
-- so no anon INSERT policy is required.

CREATE TABLE public.widget_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id   uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  session_id   text        NOT NULL,
  event_type   text        NOT NULL
               CHECK (event_type IN ('view','characteristic_changed','inquiry_started','inquiry_submitted')),
  payload      jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Tenant-scoped read for authenticated users (admin analytics page)
ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "widget_events_tenant_read" ON public.widget_events
  FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id());

-- Indexes for common query patterns
CREATE INDEX idx_widget_events_tenant_day
  ON public.widget_events (tenant_id, created_at DESC);

CREATE INDEX idx_widget_events_product_day
  ON public.widget_events (product_id, created_at DESC);

-- Used by the rate-limit check inside ingest-events
CREATE INDEX idx_widget_events_session_recent
  ON public.widget_events (session_id, created_at DESC);
