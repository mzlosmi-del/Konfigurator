-- Migration 058: Backfill hex_color on tenant-cloned characteristic values
--
-- clone-template/index.ts previously omitted hex_color when copying values
-- from the system template, so all tenant copies have hex_color = NULL even
-- after migration 057 filled in the system-template rows.
--
-- This migration copies hex_color from the system-template value that shares
-- the same label onto every tenant copy with the same label under any colour
-- characteristic (display_type = 'swatch') where hex_color is currently NULL.

UPDATE public.characteristic_values AS cv
SET    hex_color = sys.hex_color
FROM   public.characteristic_values AS sys
JOIN   public.characteristics AS sc
       ON sc.id = sys.characteristic_id
       AND sc.tenant_id = '00000000-0000-0000-0000-000000000000'
       AND sc.display_type = 'swatch'
JOIN   public.characteristics AS tc
       ON tc.id = cv.characteristic_id
       AND tc.tenant_id != '00000000-0000-0000-0000-000000000000'
       AND tc.display_type = 'swatch'
       AND tc.name = sc.name
WHERE  sys.tenant_id = '00000000-0000-0000-0000-000000000000'
  AND  sys.hex_color IS NOT NULL
  AND  cv.label = sys.label
  AND  cv.hex_color IS NULL;
