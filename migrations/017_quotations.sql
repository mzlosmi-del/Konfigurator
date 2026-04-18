-- 017_quotations.sql
-- Admin-initiated quotations with line items, adjustments (surcharge/discount/tax), and PDF generation

CREATE TABLE quotations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL DEFAULT auth_tenant_id() REFERENCES tenants(id) ON DELETE CASCADE,
  reference_number text NOT NULL,
  customer_name    text NOT NULL,
  customer_email   text NOT NULL,
  customer_company text,
  customer_phone   text,
  customer_address text,
  notes            text,
  valid_until      date,
  currency         text NOT NULL DEFAULT 'EUR',
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  total_price      numeric(12,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  line_items       jsonb NOT NULL DEFAULT '[]',
  adjustments      jsonb NOT NULL DEFAULT '[]',
  pdf_url          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant access" ON quotations
  FOR ALL
  USING (tenant_id = auth_tenant_id());

-- Keep updated_at current
CREATE TRIGGER quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
