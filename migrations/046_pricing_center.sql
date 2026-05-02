-- 046_pricing_center.sql
-- Pricing Center: scheduled prices, modifier schedules, tax presets, adjustment presets

-- ── 1. Scheduled base prices per product ─────────────────────────────────────
CREATE TABLE product_price_schedules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id           uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price                numeric(12,2) NOT NULL CHECK (price >= 0),
  valid_from           date NOT NULL,
  valid_to             date,
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

ALTER TABLE product_price_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_product_price_schedules" ON product_price_schedules
  USING (tenant_id = auth_tenant_id());

CREATE INDEX idx_product_price_schedules_product ON product_price_schedules(product_id);
CREATE INDEX idx_product_price_schedules_validity ON product_price_schedules(product_id, valid_from, valid_to);

-- ── 2. Scheduled price-modifier overrides per characteristic value ────────────
CREATE TABLE characteristic_modifier_schedules (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  characteristic_value_id uuid NOT NULL REFERENCES characteristic_values(id) ON DELETE CASCADE,
  price_modifier          numeric(12,2) NOT NULL,
  valid_from              date NOT NULL,
  valid_to                date,
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

ALTER TABLE characteristic_modifier_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_characteristic_modifier_schedules" ON characteristic_modifier_schedules
  USING (tenant_id = auth_tenant_id());

CREATE INDEX idx_char_modifier_schedules_value ON characteristic_modifier_schedules(characteristic_value_id);

-- ── 3. Tax rate presets per product ──────────────────────────────────────────
CREATE TABLE product_tax_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       text NOT NULL,
  rate        numeric(7,4) NOT NULL CHECK (rate > 0),  -- e.g. 20 = 20%
  valid_from  date NOT NULL,
  valid_to    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

ALTER TABLE product_tax_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_product_tax_presets" ON product_tax_presets
  USING (tenant_id = auth_tenant_id());

CREATE INDEX idx_product_tax_presets_product ON product_tax_presets(product_id);

-- ── 4. Preset adjustments (discounts / surcharges) per product ───────────────
CREATE TABLE product_adjustment_presets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label           text NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('surcharge', 'discount')),
  mode            text NOT NULL CHECK (mode IN ('percent', 'fixed')),
  value           numeric(12,2) NOT NULL CHECK (value > 0),
  valid_from      date NOT NULL,
  valid_to        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

ALTER TABLE product_adjustment_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_product_adjustment_presets" ON product_adjustment_presets
  USING (tenant_id = auth_tenant_id());

CREATE INDEX idx_product_adjustment_presets_product ON product_adjustment_presets(product_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_product_price_schedules_updated_at
  BEFORE UPDATE ON product_price_schedules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_char_modifier_schedules_updated_at
  BEFORE UPDATE ON characteristic_modifier_schedules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_product_tax_presets_updated_at
  BEFORE UPDATE ON product_tax_presets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_product_adjustment_presets_updated_at
  BEFORE UPDATE ON product_adjustment_presets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
