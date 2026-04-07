-- =============================================================================
-- VERIFICATION QUERIES
-- Run these in Supabase SQL Editor (as service_role) to confirm correctness
-- =============================================================================

-- 1. Confirm all tables exist with correct columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'tenants', 'profiles', 'products', 'characteristics',
    'product_characteristics', 'characteristic_values',
    'visualization_assets', 'configuration_rules', 'inquiries'
  )
ORDER BY table_name, ordinal_position;


-- 2. Confirm RLS is enabled on all tables that need it
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'products', 'characteristics', 'product_characteristics',
    'characteristic_values', 'visualization_assets', 'configuration_rules', 'inquiries'
  )
ORDER BY tablename;
-- All should show rowsecurity = true


-- 3. List all RLS policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- 4. Verify seed data loaded correctly
SELECT
  t.name AS tenant,
  p.name AS product,
  p.status,
  p.base_price,
  c.name AS characteristic,
  cv.label AS value,
  cv.price_modifier
FROM public.tenants t
JOIN public.products p ON p.tenant_id = t.id
JOIN public.product_characteristics pc ON pc.product_id = p.id
JOIN public.characteristics c ON c.id = pc.characteristic_id
JOIN public.characteristic_values cv ON cv.characteristic_id = c.id
ORDER BY c.sort_order, cv.sort_order;


-- 5. Verify visualization assets
SELECT
  p.name AS product,
  cv.label AS triggers_on_value,
  va.asset_type,
  va.is_default,
  va.url
FROM public.visualization_assets va
JOIN public.products p ON p.id = va.product_id
LEFT JOIN public.characteristic_values cv ON cv.id = va.characteristic_value_id
ORDER BY va.is_default DESC, va.sort_order;


-- 6. Verify configuration rules
SELECT
  p.name AS product,
  cr.rule_type,
  cr.condition,
  cr.effect,
  cr.is_active
FROM public.configuration_rules cr
JOIN public.products p ON p.id = cr.product_id;


-- 7. Test auth_tenant_id() helper function (run as authenticated user, not service_role)
-- SELECT auth_tenant_id();
-- Should return the tenant_id linked to the currently authenticated user.


-- 8. Simulate anon widget read — should return published product config
-- (run this as anon role to verify RLS)
-- SELECT id, name, base_price, currency, status FROM public.products WHERE status = 'published';
-- SELECT * FROM public.characteristics;
-- SELECT * FROM public.characteristic_values;
-- SELECT * FROM public.product_characteristics;
-- SELECT * FROM public.configuration_rules WHERE is_active = true;


-- 9. Simulate anon inquiry insert (replace UUIDs with real values from seed)
-- INSERT INTO public.inquiries
--   (tenant_id, product_id, customer_name, customer_email, message, configuration, total_price, currency)
-- VALUES (
--   'a1000000-0000-0000-0000-000000000001',
--   'a3000000-0000-0000-0000-000000000001',
--   'Ivan Horvat',
--   'ivan@example.com',
--   'Please send me a quote for this configuration.',
--   '[{"characteristic_name":"Material","value_label":"Walnut","price_modifier":150.00},
--     {"characteristic_name":"Size","value_label":"100x100 cm","price_modifier":80.00}]',
--   1030.00,
--   'EUR'
-- );


-- 10. Confirm anon CANNOT read inquiries (should return 0 rows or permission denied)
-- Run as anon role:
-- SELECT * FROM public.inquiries;
