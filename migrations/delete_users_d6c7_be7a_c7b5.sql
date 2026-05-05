-- Delete 3 users and all their tenant data
--
-- Cascade chain:
--   DELETE tenants  → cascades to products, characteristics, inquiries,
--                     quotations, visualization_assets, rules, formulas,
--                     profiles, and every other tenant_id-bearing table
--   DELETE auth.users → cascades to profiles (already gone, but cleans
--                       up any remaining auth metadata)
--
-- Run in Supabase SQL editor (requires service-role / superuser access).

DO $$
DECLARE
  target_users uuid[] := ARRAY[
    'd6c7075a-8f30-4972-afa3-3a148ce843ba'::uuid,
    'be7a2f65-e5f4-4f14-972a-b0ffa7b29e80'::uuid,
    'c7b5c242-65fb-459c-ab5f-8fae909a8d67'::uuid
  ];
  tenant_ids uuid[];
  uid uuid;
  tid uuid;
BEGIN

  -- 1. Resolve tenant IDs from profiles
  SELECT ARRAY(
    SELECT DISTINCT tenant_id
    FROM   public.profiles
    WHERE  id = ANY(target_users)
  ) INTO tenant_ids;

  IF array_length(tenant_ids, 1) IS NULL THEN
    RAISE NOTICE 'No profiles found for the given user IDs — nothing to delete.';
    RETURN;
  END IF;

  FOREACH tid IN ARRAY tenant_ids LOOP
    RAISE NOTICE 'Will delete tenant %', tid;
  END LOOP;

  -- 2. Delete tenants (cascades to ALL tenant-scoped tables, including profiles)
  --    Exclude the system template tenant as a safety net.
  DELETE FROM public.tenants
  WHERE  id = ANY(tenant_ids)
    AND  id != '00000000-0000-0000-0000-000000000000';

  GET DIAGNOSTICS -- just for the notice
    tid = ROW_COUNT; -- reuse variable as a counter
  RAISE NOTICE 'Deleted % tenant row(s)', (
    SELECT COUNT(*) FROM unnest(tenant_ids) t
    WHERE t != '00000000-0000-0000-0000-000000000000'
  );

  -- 3. Delete auth users (cascades to profiles if not already gone)
  FOREACH uid IN ARRAY target_users LOOP
    DELETE FROM auth.users WHERE id = uid;
    IF FOUND THEN
      RAISE NOTICE 'Deleted auth.users %', uid;
    ELSE
      RAISE NOTICE 'auth.users % not found (already deleted?)', uid;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done.';
END $$;
