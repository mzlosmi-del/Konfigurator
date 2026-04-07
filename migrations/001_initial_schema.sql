-- =============================================================================
-- Product Configurator SaaS — MVP Schema Migration
-- Migration: 001_initial_schema
-- Compatible with: Supabase (PostgreSQL 15+)
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() fallback (pg14-)
-- Note: pg15+ has gen_random_uuid() built-in. Supabase exposes it by default.


-- =============================================================================
-- HELPER: updated_at trigger function (shared across all tables)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE: tenants
-- One row per merchant/customer of the SaaS.
-- =============================================================================

CREATE TABLE public.tenants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  slug        text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9\-]+$'),  -- used in embed
  plan        text        NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free', 'starter', 'pro')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- No RLS on tenants itself — access is mediated through profiles.
-- Authenticated users read their own tenant via the profiles join.


-- =============================================================================
-- TABLE: profiles
-- Extends Supabase auth.users. Created automatically on user sign-up via trigger.
-- =============================================================================

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'admin'
                          CHECK (role IN ('admin')),  -- expand later: 'viewer', 'member'
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- A user can only read/update their own profile row.
CREATE POLICY "profiles: user reads own row"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: user updates own row"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Anon cannot access profiles at all.


-- =============================================================================
-- TRIGGER: auto-create profile on auth.users insert
-- Called by a Supabase Database Webhook or this trigger on auth schema.
-- NOTE: Supabase recommends a Database Function + Webhook for this.
--       The trigger below works if you have access to the auth schema trigger.
--       See "Manual Verification" notes at end of file.
-- =============================================================================

-- This function is called by Supabase's auth hook (set up separately in dashboard)
-- It expects raw_user_meta_data to contain: { tenant_name, tenant_slug }
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Create the tenant first
  INSERT INTO public.tenants (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'tenant_name', 'My Company'),
    COALESCE(NEW.raw_user_meta_data->>'tenant_slug', 'tenant-' || substr(NEW.id::text, 1, 8))
  )
  RETURNING id INTO new_tenant_id;

  -- Create the profile linking user to tenant
  INSERT INTO public.profiles (id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  RETURN NEW;
END;
$$;

-- This trigger fires on auth.users insert (requires Supabase service role or dashboard setup)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- HELPER: resolve current user's tenant_id from profiles
-- Defined here — after the profiles table exists — and used in all RLS policies below.
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;


-- =============================================================================
-- TABLE: products
-- =============================================================================

CREATE TABLE public.products (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  description   text,
  base_price    numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  currency      text        NOT NULL DEFAULT 'EUR' CHECK (char_length(currency) = 3),
  status        text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'published', 'archived')),
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_tenant_id        ON public.products(tenant_id);
CREATE INDEX idx_products_tenant_status    ON public.products(tenant_id, status);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Authenticated: full CRUD within own tenant
CREATE POLICY "products: tenant admin full access"
  ON public.products FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Anon: read-only, published only
CREATE POLICY "products: anon reads published"
  ON public.products FOR SELECT
  TO anon
  USING (status = 'published');


-- =============================================================================
-- TABLE: characteristics
-- Tenant-level library. Can be reused across multiple products.
-- =============================================================================

CREATE TABLE public.characteristics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  display_type  text        NOT NULL DEFAULT 'select'
                            CHECK (display_type IN ('select', 'radio', 'swatch', 'toggle')),
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_characteristics_tenant_id ON public.characteristics(tenant_id);

CREATE TRIGGER characteristics_updated_at
  BEFORE UPDATE ON public.characteristics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.characteristics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characteristics: tenant admin full access"
  ON public.characteristics FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Anon reads characteristics for published products (checked via widget join)
CREATE POLICY "characteristics: anon reads all"
  ON public.characteristics FOR SELECT
  TO anon
  USING (true);
-- NOTE: This is intentionally permissive for characteristics —
-- they contain no sensitive data (just labels like "Color", "Material").
-- Tenant data isolation is enforced at product level.


-- =============================================================================
-- TABLE: product_characteristics
-- Junction: which characteristics are attached to which product, and in what order.
-- =============================================================================

CREATE TABLE public.product_characteristics (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  characteristic_id   uuid    NOT NULL REFERENCES public.characteristics(id) ON DELETE CASCADE,
  is_required         boolean NOT NULL DEFAULT true,
  sort_order          int     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, characteristic_id)
);

CREATE INDEX idx_pc_product_id        ON public.product_characteristics(product_id);
CREATE INDEX idx_pc_characteristic_id ON public.product_characteristics(characteristic_id);

ALTER TABLE public.product_characteristics ENABLE ROW LEVEL SECURITY;

-- Authenticated: can manage product_characteristics if they own the product
CREATE POLICY "product_characteristics: tenant admin via product"
  ON public.product_characteristics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.tenant_id = auth_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.tenant_id = auth_tenant_id()
    )
  );

-- Anon: read only (needed for widget to know which characteristics a product has)
CREATE POLICY "product_characteristics: anon reads published products"
  ON public.product_characteristics FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'published'
    )
  );


-- =============================================================================
-- TABLE: characteristic_values
-- The selectable options within a characteristic (e.g. "Oak", "White", "120cm").
-- =============================================================================

CREATE TABLE public.characteristic_values (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  characteristic_id   uuid          NOT NULL REFERENCES public.characteristics(id) ON DELETE CASCADE,
  tenant_id           uuid          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label               text          NOT NULL CHECK (char_length(label) BETWEEN 1 AND 300),
  price_modifier      numeric(12,2) NOT NULL DEFAULT 0,  -- can be negative (discount)
  sort_order          int           NOT NULL DEFAULT 0,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_cv_characteristic_id ON public.characteristic_values(characteristic_id);
CREATE INDEX idx_cv_tenant_id         ON public.characteristic_values(tenant_id);

CREATE TRIGGER characteristic_values_updated_at
  BEFORE UPDATE ON public.characteristic_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.characteristic_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "characteristic_values: tenant admin full access"
  ON public.characteristic_values FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "characteristic_values: anon reads all"
  ON public.characteristic_values FOR SELECT
  TO anon
  USING (true);
-- NOTE: Same rationale as characteristics — values (labels + price modifiers)
-- are product config data, not sensitive tenant data.


-- =============================================================================
-- TABLE: visualization_assets
-- Images/renders tied to a product (default) or a specific characteristic_value.
-- When characteristic_value_id IS NULL, this is the product's default visual.
-- =============================================================================

CREATE TABLE public.visualization_assets (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id              uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  characteristic_value_id uuid    REFERENCES public.characteristic_values(id) ON DELETE SET NULL,
  asset_type              text    NOT NULL DEFAULT 'image'
                                  CHECK (asset_type IN ('image', 'render', '3d_model')),
  url                     text    NOT NULL CHECK (char_length(url) > 0),
  is_default              boolean NOT NULL DEFAULT false,
  sort_order              int     NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_va_product_id  ON public.visualization_assets(product_id);
CREATE INDEX idx_va_cv_id       ON public.visualization_assets(characteristic_value_id);
CREATE INDEX idx_va_tenant_id   ON public.visualization_assets(tenant_id);

CREATE TRIGGER visualization_assets_updated_at
  BEFORE UPDATE ON public.visualization_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.visualization_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visualization_assets: tenant admin full access"
  ON public.visualization_assets FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "visualization_assets: anon reads published products"
  ON public.visualization_assets FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'published'
    )
  );


-- =============================================================================
-- TABLE: configuration_rules
-- Simple single-condition rules: IF [char/value] THEN [hide/disable/price_override].
-- Evaluated client-side in the widget.
-- =============================================================================

CREATE TABLE public.configuration_rules (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id    uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rule_type     text    NOT NULL
                        CHECK (rule_type IN ('hide_value', 'disable_value', 'price_override')),
  -- condition: which selection triggers this rule
  -- e.g. {"characteristic_id": "...", "value_id": "..."}
  condition     jsonb   NOT NULL,
  -- effect: what happens when condition is met
  -- hide_value/disable_value: {"characteristic_id": "...", "value_id": "..."}
  -- price_override: {"price_modifier": 0.00}
  effect        jsonb   NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_product_id ON public.configuration_rules(product_id);
CREATE INDEX idx_rules_tenant_id  ON public.configuration_rules(tenant_id);

CREATE TRIGGER configuration_rules_updated_at
  BEFORE UPDATE ON public.configuration_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.configuration_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuration_rules: tenant admin full access"
  ON public.configuration_rules FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "configuration_rules: anon reads published products"
  ON public.configuration_rules FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'published'
    )
  );


-- =============================================================================
-- TABLE: inquiries
-- Customer quote/inquiry submissions. Written by anon, read by authenticated admin.
-- =============================================================================

CREATE TABLE public.inquiries (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id      uuid    NOT NULL REFERENCES public.products(id) ON DELETE SET NULL,
  customer_name   text    NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 300),
  customer_email  text    NOT NULL CHECK (customer_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  message         text,
  -- Snapshot of the configuration at time of submission.
  -- Array of: [{characteristic_name, value_label, price_modifier}]
  -- Store as snapshot so it's readable even if config changes later.
  configuration   jsonb   NOT NULL DEFAULT '[]',
  total_price     numeric(12,2) CHECK (total_price >= 0),
  currency        text    NOT NULL DEFAULT 'EUR',
  status          text    NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'read', 'replied', 'closed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_tenant_id  ON public.inquiries(tenant_id);
CREATE INDEX idx_inquiries_product_id ON public.inquiries(product_id);
CREATE INDEX idx_inquiries_status     ON public.inquiries(tenant_id, status);
CREATE INDEX idx_inquiries_created    ON public.inquiries(tenant_id, created_at DESC);

CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Authenticated admin: full access to their tenant's inquiries
CREATE POLICY "inquiries: tenant admin full access"
  ON public.inquiries FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Anon: INSERT only. No SELECT. tenant_id must be supplied and valid.
CREATE POLICY "inquiries: anon insert only"
  ON public.inquiries FOR INSERT
  TO anon
  WITH CHECK (
    -- Verify the product exists and is published before allowing an inquiry
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.tenant_id = inquiries.tenant_id
        AND p.status = 'published'
    )
  );
