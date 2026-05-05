-- Migration 058: Backfill hex_color on tenant-cloned characteristic values
--
-- clone-template/index.ts previously omitted hex_color when copying values
-- from the system template, so all tenant copies have hex_color = NULL even
-- after migration 057 filled in the system-template rows.
--
-- For every tenant value (hex_color IS NULL) under a swatch characteristic,
-- find the system-template value with the same label under a swatch
-- characteristic of the same name, and copy its hex_color.

UPDATE public.characteristic_values AS cv
SET    hex_color = src.hex_color
FROM   public.characteristics       AS tc,
       public.characteristic_values AS sys,
       public.characteristics       AS sc,
       LATERAL (SELECT sys.hex_color) AS src
WHERE  cv.hex_color IS NULL
  AND  cv.characteristic_id = tc.id
  AND  tc.display_type      = 'swatch'
  AND  tc.tenant_id        != '00000000-0000-0000-0000-000000000000'
  AND  sys.tenant_id        = '00000000-0000-0000-0000-000000000000'
  AND  sys.hex_color       IS NOT NULL
  AND  sys.label            = cv.label
  AND  sys.characteristic_id = sc.id
  AND  sc.display_type      = 'swatch'
  AND  sc.tenant_id         = '00000000-0000-0000-0000-000000000000'
  AND  sc.name              = tc.name;
