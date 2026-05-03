-- Migration 047: Add EN + SR translations to all 8 template/sample products
-- Targets tenant_id = '00000000-0000-0000-0000-000000000000' (system workspace)
-- Updates: products, characteristics, characteristic_values, characteristic_classes

DO $$
DECLARE
  sys_tid uuid := '00000000-0000-0000-0000-000000000000';
BEGIN

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PRODUCTS — name_i18n + description_i18n
-- ═══════════════════════════════════════════════════════════════════════════

  UPDATE public.products SET
    name_i18n        = '{"en":"Custom Desk","sr":"Prilagođeni sto"}',
    description_i18n = '{"en":"Configurable work desk with choice of size, material and leg style.","sr":"Konfigurabilni radni sto sa izborom veličine, materijala i stila nogu."}'
  WHERE tenant_id = sys_tid AND name = 'Custom Desk';

  UPDATE public.products SET
    name_i18n        = '{"en":"Bookshelf","sr":"Polica za knjige"}',
    description_i18n = '{"en":"Choose your width, height and material.","sr":"Izaberite širinu, visinu i materijal."}'
  WHERE tenant_id = sys_tid AND name = 'Bookshelf';

  UPDATE public.products SET
    name_i18n        = '{"en":"Office Chair","sr":"Kancelarijska stolica"}',
    description_i18n = '{"en":"Ergonomic chair with configurable armrests, base and upholstery.","sr":"Ergonomska stolica sa konfigurabilnim naslonom za ruke, bazom i presvlakom."}'
  WHERE tenant_id = sys_tid AND name = 'Office Chair';

  UPDATE public.products SET
    name_i18n        = '{"en":"Dining Table","sr":"Trpezarijski sto"}',
    description_i18n = '{"en":"Choose shape, seating capacity and surface material.","sr":"Izaberite oblik, kapacitet sedenja i materijal površine."}'
  WHERE tenant_id = sys_tid AND name = 'Dining Table';

  UPDATE public.products SET
    name_i18n        = '{"en":"Single Window","sr":"Jednokrilni prozor"}',
    description_i18n = '{"en":"Standard window with opening type and glazing options.","sr":"Standardni prozor sa opcijama otvaranja i ostakljenja."}'
  WHERE tenant_id = sys_tid AND name = 'Single Window';

  UPDATE public.products SET
    name_i18n        = '{"en":"Sliding Door","sr":"Klizna vrata"}',
    description_i18n = '{"en":"Sliding glass door with configurable dimensions and frame material.","sr":"Klizna staklena vrata sa konfigurabilnim dimenzijama i materijalom okvira."}'
  WHERE tenant_id = sys_tid AND name = 'Sliding Door';

  UPDATE public.products SET
    name_i18n        = '{"en":"Bay Window","sr":"Erkerni prozor"}',
    description_i18n = '{"en":"Three-panel projecting window with style and glazing choice.","sr":"Trokrilni izbočeni prozor sa izborom stila i ostakljenja."}'
  WHERE tenant_id = sys_tid AND name = 'Bay Window';

  UPDATE public.products SET
    name_i18n        = '{"en":"Skylight","sr":"Krovni prozor"}',
    description_i18n = '{"en":"Roof skylight with size and venting options.","sr":"Krovni prozor sa opcijama veličine i ventilacije."}'
  WHERE tenant_id = sys_tid AND name = 'Skylight';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CHARACTERISTIC CLASSES — name_i18n (named after products)
-- ═══════════════════════════════════════════════════════════════════════════

  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Custom Desk","sr":"Prilagođeni sto"}'      WHERE tenant_id = sys_tid AND name = 'Custom Desk';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Bookshelf","sr":"Polica za knjige"}'        WHERE tenant_id = sys_tid AND name = 'Bookshelf';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Office Chair","sr":"Kancelarijska stolica"}' WHERE tenant_id = sys_tid AND name = 'Office Chair';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Dining Table","sr":"Trpezarijski sto"}'     WHERE tenant_id = sys_tid AND name = 'Dining Table';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Single Window","sr":"Jednokrilni prozor"}'  WHERE tenant_id = sys_tid AND name = 'Single Window';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Sliding Door","sr":"Klizna vrata"}'         WHERE tenant_id = sys_tid AND name = 'Sliding Door';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Bay Window","sr":"Erkerni prozor"}'         WHERE tenant_id = sys_tid AND name = 'Bay Window';
  UPDATE public.characteristic_classes SET name_i18n = '{"en":"Skylight","sr":"Krovni prozor"}'            WHERE tenant_id = sys_tid AND name = 'Skylight';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CHARACTERISTICS — name_i18n (shared names updated once each)
-- ═══════════════════════════════════════════════════════════════════════════

  UPDATE public.characteristics SET name_i18n = '{"en":"Size","sr":"Veličina"}'           WHERE tenant_id = sys_tid AND name = 'Size';
  UPDATE public.characteristics SET name_i18n = '{"en":"Material","sr":"Materijal"}'       WHERE tenant_id = sys_tid AND name = 'Material';
  UPDATE public.characteristics SET name_i18n = '{"en":"Leg style","sr":"Stil nogu"}'      WHERE tenant_id = sys_tid AND name = 'Leg style';
  UPDATE public.characteristics SET name_i18n = '{"en":"Width","sr":"Širina"}'             WHERE tenant_id = sys_tid AND name = 'Width';
  UPDATE public.characteristics SET name_i18n = '{"en":"Height","sr":"Visina"}'            WHERE tenant_id = sys_tid AND name = 'Height';
  UPDATE public.characteristics SET name_i18n = '{"en":"Armrests","sr":"Nasloni za ruke"}' WHERE tenant_id = sys_tid AND name = 'Armrests';
  UPDATE public.characteristics SET name_i18n = '{"en":"Base","sr":"Baza"}'                WHERE tenant_id = sys_tid AND name = 'Base';
  UPDATE public.characteristics SET name_i18n = '{"en":"Upholstery","sr":"Presvlaka"}'     WHERE tenant_id = sys_tid AND name = 'Upholstery';
  UPDATE public.characteristics SET name_i18n = '{"en":"Shape","sr":"Oblik"}'              WHERE tenant_id = sys_tid AND name = 'Shape';
  UPDATE public.characteristics SET name_i18n = '{"en":"Seats","sr":"Sedišta"}'            WHERE tenant_id = sys_tid AND name = 'Seats';
  UPDATE public.characteristics SET name_i18n = '{"en":"Surface","sr":"Površina"}'         WHERE tenant_id = sys_tid AND name = 'Surface';
  UPDATE public.characteristics SET name_i18n = '{"en":"Opening type","sr":"Tip otvaranja"}' WHERE tenant_id = sys_tid AND name = 'Opening type';
  UPDATE public.characteristics SET name_i18n = '{"en":"Glazing","sr":"Ostakljenje"}'      WHERE tenant_id = sys_tid AND name = 'Glazing';
  UPDATE public.characteristics SET name_i18n = '{"en":"Frame","sr":"Okvir"}'              WHERE tenant_id = sys_tid AND name = 'Frame';
  UPDATE public.characteristics SET name_i18n = '{"en":"Style","sr":"Stil"}'               WHERE tenant_id = sys_tid AND name = 'Style';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. CHARACTERISTIC VALUES — label_i18n
-- Dimension-only labels (pure numbers/units) keep the same value in both langs.
-- Only labels with translatable words get SR translations.
-- ═══════════════════════════════════════════════════════════════════════════

  -- Desk sizes
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Small (120 cm)","sr":"Malo (120 cm)"}'    WHERE tenant_id = sys_tid AND label = 'Small (120 cm)';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Medium (150 cm)","sr":"Srednje (150 cm)"}' WHERE tenant_id = sys_tid AND label = 'Medium (150 cm)';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Large (180 cm)","sr":"Veliko (180 cm)"}'  WHERE tenant_id = sys_tid AND label = 'Large (180 cm)';

  -- Wood materials
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Oak","sr":"Hrast"}'     WHERE tenant_id = sys_tid AND label = 'Oak';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Walnut","sr":"Orah"}'   WHERE tenant_id = sys_tid AND label = 'Walnut';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Pine","sr":"Bor"}'      WHERE tenant_id = sys_tid AND label = 'Pine';

  -- Leg styles
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Wood leg","sr":"Drvene noge"}'   WHERE tenant_id = sys_tid AND label = 'Wood leg';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Metal leg","sr":"Metalne noge"}' WHERE tenant_id = sys_tid AND label = 'Metal leg';

  -- Chair armrests
  UPDATE public.characteristic_values SET label_i18n = '{"en":"None","sr":"Bez"}'           WHERE tenant_id = sys_tid AND label = 'None';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Fixed","sr":"Fiksni"}'        WHERE tenant_id = sys_tid AND label = 'Fixed';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Adjustable","sr":"Podešivi"}' WHERE tenant_id = sys_tid AND label = 'Adjustable';

  -- Chair bases
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Nylon 5-star","sr":"Najlon petokraka"}'           WHERE tenant_id = sys_tid AND label = 'Nylon 5-star';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Aluminium 5-star","sr":"Aluminijumska petokraka"}' WHERE tenant_id = sys_tid AND label = 'Aluminium 5-star';

  -- Chair upholstery
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Mesh","sr":"Mrežica"}'   WHERE tenant_id = sys_tid AND label = 'Mesh';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Fabric","sr":"Tkanina"}' WHERE tenant_id = sys_tid AND label = 'Fabric';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Leather","sr":"Koža"}'   WHERE tenant_id = sys_tid AND label = 'Leather';

  -- Dining table shapes
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Round","sr":"Okrugli"}'         WHERE tenant_id = sys_tid AND label = 'Round';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Rectangle","sr":"Pravougaoni"}' WHERE tenant_id = sys_tid AND label = 'Rectangle';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Oval","sr":"Ovalni"}'           WHERE tenant_id = sys_tid AND label = 'Oval';

  -- Dining table seats
  UPDATE public.characteristic_values SET label_i18n = '{"en":"4 persons","sr":"4 osobe"}' WHERE tenant_id = sys_tid AND label = '4 persons';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"6 persons","sr":"6 osoba"}' WHERE tenant_id = sys_tid AND label = '6 persons';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"8 persons","sr":"8 osoba"}' WHERE tenant_id = sys_tid AND label = '8 persons';

  -- Dining table / shared surfaces
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Glass top","sr":"Staklena ploča"}' WHERE tenant_id = sys_tid AND label = 'Glass top';

  -- Window opening types
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Casement","sr":"Krilni"}'   WHERE tenant_id = sys_tid AND label = 'Casement';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Tilt-turn","sr":"Kip-turn"}' WHERE tenant_id = sys_tid AND label = 'Tilt-turn';

  -- Glazing options
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Single glazing","sr":"Jednostruko ostakljenje"}' WHERE tenant_id = sys_tid AND label = 'Single glazing';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Double glazing","sr":"Dvostruko ostakljenje"}'   WHERE tenant_id = sys_tid AND label = 'Double glazing';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Triple glazing","sr":"Trostruko ostakljenje"}'   WHERE tenant_id = sys_tid AND label = 'Triple glazing';

  -- Sliding door frame
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Aluminium","sr":"Aluminijum"}' WHERE tenant_id = sys_tid AND label = 'Aluminium';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Wood","sr":"Drvo"}'            WHERE tenant_id = sys_tid AND label = 'Wood';

  -- Bay window styles
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Victorian","sr":"Viktorijanski"}'  WHERE tenant_id = sys_tid AND label = 'Victorian';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Edwardian","sr":"Edvardijanski"}'  WHERE tenant_id = sys_tid AND label = 'Edwardian';
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Modern","sr":"Moderni"}'           WHERE tenant_id = sys_tid AND label = 'Modern';

  -- Skylight opening
  UPDATE public.characteristic_values SET label_i18n = '{"en":"Venting","sr":"Prozračni"}' WHERE tenant_id = sys_tid AND label = 'Venting';

END $$;
