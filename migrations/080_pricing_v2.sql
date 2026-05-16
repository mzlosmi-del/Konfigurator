-- Migration 080: Pricing v2 — Free / Starter €49 / Growth €129 / Scale €349
-- Idempotent upsert. Overwrites values from migrations 029 / 039.
-- Plan names and column shapes unchanged; only numbers shift.

INSERT INTO public.plan_limits
  (plan,      products_max, inquiries_per_month, team_members_max,
   three_d, quotations, webhooks, remove_branding, white_label,
   ai_setup_per_month, analytics,
   monthly_price_eur, annual_price_eur)
VALUES
  ('free',       1,   500,   1, false, false, false, false, false,   0, 'basic',         0,       0),
  ('starter',   10,    -1,   1, false, true,  false, false, false,   5, 'basic',      4900,   49000),
  ('growth',    50,    -1,   3, true,  true,  true,  true,  false,  50, 'advanced',  12900,  129000),
  ('scale',     -1,    -1,  10, true,  true,  true,  true,  true,   -1, 'advanced',  34900,  349000)
ON CONFLICT (plan) DO UPDATE SET
  products_max         = EXCLUDED.products_max,
  inquiries_per_month  = EXCLUDED.inquiries_per_month,
  team_members_max     = EXCLUDED.team_members_max,
  three_d              = EXCLUDED.three_d,
  quotations           = EXCLUDED.quotations,
  webhooks             = EXCLUDED.webhooks,
  remove_branding      = EXCLUDED.remove_branding,
  white_label          = EXCLUDED.white_label,
  ai_setup_per_month   = EXCLUDED.ai_setup_per_month,
  analytics            = EXCLUDED.analytics,
  monthly_price_eur    = EXCLUDED.monthly_price_eur,
  annual_price_eur     = EXCLUDED.annual_price_eur;

-- Strip any rogue plans (defensive, matches 039 pattern).
DELETE FROM public.plan_limits WHERE plan NOT IN ('free','starter','growth','scale');
