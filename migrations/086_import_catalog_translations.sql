-- Migration 086: rebuild import_catalog RPC around long-form translations.
--
-- The Excel template no longer carries name_en / name_sr / description_en /
-- description_sr / label_en / label_sr inline on the entity sheets. All
-- entity-level translations move to a dedicated Translations sheet
-- ((level, reference_key, slot, language, content) rows). The canonical EN
-- name still ends up in characteristic_classes.name / characteristics.name /
-- characteristic_values.label / products.name — but now the RPC resolves it
-- from the supplied translations array rather than expecting it inline.
--
-- Slot rules:
--   class                 → name
--   characteristic        → name, description
--   characteristic_value  → label, description
--   product               → name, description
-- Every entity must have a translation row with language='en' and the
-- canonical slot ('name' or 'label'). The client parser already enforces
-- this; the RPC re-checks for safety.
--
-- CREATE OR REPLACE so re-running this migration is safe. Drops the
-- v_classes/v_chars/etc. inline-name logic from migration 085.

CREATE OR REPLACE FUNCTION public.import_catalog(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.auth_tenant_id();

  -- Maps from user-supplied key → inserted UUID, per level.
  v_class_ids    jsonb := '{}'::jsonb;
  v_char_ids     jsonb := '{}'::jsonb;
  v_value_ids    jsonb := '{}'::jsonb;
  v_product_ids  jsonb := '{}'::jsonb;

  -- Map from "<level>::<key>::<slot>::<language>" → content, populated up
  -- front from the translations array so each entity insert can pick up its
  -- canonical EN name without a nested scan.
  v_translations jsonb := '{}'::jsonb;

  v_classes_created     int := 0;
  v_chars_created       int := 0;
  v_values_created      int := 0;
  v_products_created    int := 0;
  v_translations_created int := 0;
  v_texts_created       int := 0;
  v_specs_created       int := 0;

  v_row jsonb;
  v_key text;
  v_id  uuid;
  v_ref_id uuid;
  v_class_keys jsonb;
  v_class_key text;
  v_level text;
  v_slot text;
  v_language text;
  v_canon_en text;
  v_tkey text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.auth_can('library', 'edit') OR NOT public.auth_can('products', 'edit') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501',
      DETAIL = json_build_object('code', 'forbidden')::text;
  END IF;

  -- ── 0. Build translation lookup ──────────────────────────────────────────
  -- Single forward pass so each entity insert can fetch its canonical EN.
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'translations', '[]'::jsonb))
  LOOP
    v_tkey := concat_ws('::',
      v_row->>'level',
      v_row->>'reference_key',
      v_row->>'slot',
      v_row->>'language'
    );
    v_translations := jsonb_set(v_translations, ARRAY[v_tkey], to_jsonb((v_row->>'content')::text));
  END LOOP;

  -- ── 1. Classes ───────────────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'classes', '[]'::jsonb))
  LOOP
    v_key := v_row->>'key';
    v_canon_en := v_translations->>concat('class::', v_key, '::name::en');

    IF v_canon_en IS NULL OR length(v_canon_en) = 0 THEN
      RAISE EXCEPTION 'Class "%" has no EN name in the Translations sheet', v_key
        USING ERRCODE = 'P0001',
              DETAIL = json_build_object('code', 'missing_canonical_en', 'sheet', 'Translations', 'level', 'class', 'key', v_key)::text;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.characteristic_classes
      WHERE tenant_id = v_tenant_id AND lower(name) = lower(v_canon_en)
    ) THEN
      RAISE EXCEPTION 'Class "%" already exists', v_canon_en
        USING ERRCODE = '23505',
              DETAIL = json_build_object('code', 'conflict', 'sheet', 'Classes', 'key', v_key, 'name', v_canon_en)::text;
    END IF;

    INSERT INTO public.characteristic_classes
      (tenant_id, name, name_i18n, sort_order)
    VALUES (
      v_tenant_id,
      v_canon_en,
      jsonb_strip_nulls(jsonb_build_object(
        'en', v_canon_en,
        'sr', v_translations->>concat('class::', v_key, '::name::sr')
      )),
      COALESCE((v_row->>'sort_order')::int, v_classes_created)
    )
    RETURNING id INTO v_id;

    v_class_ids := jsonb_set(v_class_ids, ARRAY[v_key], to_jsonb(v_id::text));
    v_classes_created := v_classes_created + 1;
  END LOOP;

  -- ── 2. Characteristics ───────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'characteristics', '[]'::jsonb))
  LOOP
    v_key := v_row->>'key';
    v_canon_en := v_translations->>concat('characteristic::', v_key, '::name::en');

    IF v_canon_en IS NULL OR length(v_canon_en) = 0 THEN
      RAISE EXCEPTION 'Characteristic "%" has no EN name in the Translations sheet', v_key
        USING ERRCODE = 'P0001',
              DETAIL = json_build_object('code', 'missing_canonical_en', 'sheet', 'Translations', 'level', 'characteristic', 'key', v_key)::text;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.characteristics
      WHERE tenant_id = v_tenant_id AND lower(name) = lower(v_canon_en)
    ) THEN
      RAISE EXCEPTION 'Characteristic "%" already exists', v_canon_en
        USING ERRCODE = '23505',
              DETAIL = json_build_object('code', 'conflict', 'sheet', 'Characteristics', 'key', v_key, 'name', v_canon_en)::text;
    END IF;

    INSERT INTO public.characteristics
      (tenant_id, name, display_type, sort_order)
    VALUES (
      v_tenant_id, v_canon_en,
      (v_row->>'display_type')::text,
      COALESCE((v_row->>'sort_order')::int, v_chars_created)
    )
    RETURNING id INTO v_id;

    v_char_ids := jsonb_set(v_char_ids, ARRAY[v_key], to_jsonb(v_id::text));
    v_chars_created := v_chars_created + 1;

    v_class_keys := COALESCE(v_row->'class_keys', '[]'::jsonb);
    FOR v_class_key IN SELECT jsonb_array_elements_text(v_class_keys)
    LOOP
      IF NOT (v_class_ids ? v_class_key) THEN
        RAISE EXCEPTION 'Unknown class key "%" referenced from characteristic "%"', v_class_key, v_key
          USING ERRCODE = 'P0001',
                DETAIL = json_build_object('code', 'unknown_class_key', 'key', v_class_key)::text;
      END IF;
      INSERT INTO public.characteristic_class_members (class_id, characteristic_id, sort_order)
      VALUES ((v_class_ids->>v_class_key)::uuid, v_id, 0)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- ── 3. Values ────────────────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'values', '[]'::jsonb))
  LOOP
    v_key := v_row->>'key';
    v_canon_en := v_translations->>concat('characteristic_value::', v_key, '::label::en');

    IF v_canon_en IS NULL OR length(v_canon_en) = 0 THEN
      RAISE EXCEPTION 'Value "%" has no EN label in the Translations sheet', v_key
        USING ERRCODE = 'P0001',
              DETAIL = json_build_object('code', 'missing_canonical_en', 'sheet', 'Translations', 'level', 'characteristic_value', 'key', v_key)::text;
    END IF;

    IF NOT (v_char_ids ? (v_row->>'characteristic_key')) THEN
      RAISE EXCEPTION 'Unknown characteristic key "%" referenced from value "%"',
        v_row->>'characteristic_key', v_key
        USING ERRCODE = 'P0001',
              DETAIL = json_build_object('code', 'unknown_characteristic_key', 'key', v_row->>'characteristic_key')::text;
    END IF;
    v_ref_id := (v_char_ids->>(v_row->>'characteristic_key'))::uuid;

    IF EXISTS (
      SELECT 1 FROM public.characteristic_values
      WHERE tenant_id = v_tenant_id
        AND characteristic_id = v_ref_id
        AND lower(label) = lower(v_canon_en)
    ) THEN
      RAISE EXCEPTION 'Value "%" already exists for that characteristic', v_canon_en
        USING ERRCODE = '23505',
              DETAIL = json_build_object('code', 'conflict', 'sheet', 'Values', 'key', v_key, 'name', v_canon_en)::text;
    END IF;

    INSERT INTO public.characteristic_values
      (characteristic_id, tenant_id, label, price_modifier, sort_order, hex_color)
    VALUES (
      v_ref_id, v_tenant_id, v_canon_en,
      COALESCE((v_row->>'price_modifier')::numeric, 0),
      COALESCE((v_row->>'sort_order')::int, v_values_created),
      NULLIF(v_row->>'hex_color', '')
    )
    RETURNING id INTO v_id;

    v_value_ids := jsonb_set(v_value_ids, ARRAY[v_key], to_jsonb(v_id::text));
    v_values_created := v_values_created + 1;
  END LOOP;

  -- ── 4. Products ──────────────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'products', '[]'::jsonb))
  LOOP
    v_key := v_row->>'key';
    v_canon_en := v_translations->>concat('product::', v_key, '::name::en');

    IF v_canon_en IS NULL OR length(v_canon_en) = 0 THEN
      RAISE EXCEPTION 'Product "%" has no EN name in the Translations sheet', v_key
        USING ERRCODE = 'P0001',
              DETAIL = json_build_object('code', 'missing_canonical_en', 'sheet', 'Translations', 'level', 'product', 'key', v_key)::text;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE tenant_id = v_tenant_id AND lower(name) = lower(v_canon_en)
    ) THEN
      RAISE EXCEPTION 'Product "%" already exists', v_canon_en
        USING ERRCODE = '23505',
              DETAIL = json_build_object('code', 'conflict', 'sheet', 'Products', 'key', v_key, 'name', v_canon_en)::text;
    END IF;

    INSERT INTO public.products
      (tenant_id, name, description, base_price, currency, sku, unit_of_measure, status)
    VALUES (
      v_tenant_id, v_canon_en,
      v_translations->>concat('product::', v_key, '::description::en'),
      COALESCE((v_row->>'base_price')::numeric, 0),
      COALESCE(NULLIF(v_row->>'currency', ''), 'EUR'),
      NULLIF(v_row->>'sku', ''),
      NULLIF(v_row->>'unit_of_measure', ''),
      COALESCE(NULLIF(v_row->>'status', ''), 'draft')
    )
    RETURNING id INTO v_id;

    v_product_ids := jsonb_set(v_product_ids, ARRAY[v_key], to_jsonb(v_id::text));
    v_products_created := v_products_created + 1;

    v_class_keys := COALESCE(v_row->'class_keys', '[]'::jsonb);
    FOR v_class_key IN SELECT jsonb_array_elements_text(v_class_keys)
    LOOP
      IF NOT (v_class_ids ? v_class_key) THEN
        RAISE EXCEPTION 'Unknown class key "%" referenced from product "%"', v_class_key, v_key
          USING ERRCODE = 'P0001',
                DETAIL = json_build_object('code', 'unknown_class_key', 'key', v_class_key)::text;
      END IF;
      INSERT INTO public.product_classes (product_id, class_id, sort_order)
      VALUES (v_id, (v_class_ids->>v_class_key)::uuid, 0)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- ── 5. Translations → tenant_texts (entity-level rows) ───────────────────
  -- Class names go into characteristic_classes.name_i18n (handled above),
  -- not tenant_texts (no 'class' level in the CHECK). Everything else lands
  -- in tenant_texts.
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'translations', '[]'::jsonb))
  LOOP
    v_level    := v_row->>'level';
    v_slot     := v_row->>'slot';
    v_language := v_row->>'language';
    v_key      := v_row->>'reference_key';

    IF v_level = 'class' THEN
      -- Already persisted on characteristic_classes.name_i18n.
      CONTINUE;
    END IF;

    IF v_level = 'characteristic' THEN
      IF NOT (v_char_ids ? v_key) THEN CONTINUE; END IF;
      v_ref_id := (v_char_ids->>v_key)::uuid;
    ELSIF v_level = 'characteristic_value' THEN
      IF NOT (v_value_ids ? v_key) THEN CONTINUE; END IF;
      v_ref_id := (v_value_ids->>v_key)::uuid;
    ELSIF v_level = 'product' THEN
      IF NOT (v_product_ids ? v_key) THEN CONTINUE; END IF;
      v_ref_id := (v_product_ids->>v_key)::uuid;
    ELSE
      CONTINUE;
    END IF;

    INSERT INTO public.tenant_texts
      (tenant_id, level, reference_id, slot, language, sort_order, content)
    VALUES (v_tenant_id, v_level, v_ref_id, v_slot, v_language, 0, v_row->>'content');
    v_translations_created := v_translations_created + 1;
  END LOOP;

  -- ── 6. Tenant-level texts ────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'texts', '[]'::jsonb))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.tenant_texts
      WHERE tenant_id    = v_tenant_id
        AND level        = 'tenant'
        AND reference_id IS NULL
        AND slot         = v_row->>'slot'
        AND language     = v_row->>'language'
        AND sort_order   = COALESCE((v_row->>'sort_order')::int, 0)
    ) THEN
      RAISE EXCEPTION 'Text already exists for slot "%" language "%"', v_row->>'slot', v_row->>'language'
        USING ERRCODE = '23505',
              DETAIL = json_build_object('code', 'conflict', 'sheet', 'Texts', 'slot', v_row->>'slot', 'language', v_row->>'language')::text;
    END IF;

    INSERT INTO public.tenant_texts
      (tenant_id, level, reference_id, slot, language, sort_order, content)
    VALUES (
      v_tenant_id, 'tenant', NULL,
      v_row->>'slot', v_row->>'language',
      COALESCE((v_row->>'sort_order')::int, 0),
      v_row->>'content'
    );
    v_texts_created := v_texts_created + 1;
  END LOOP;

  -- ── 7. Specifications ────────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'specifications', '[]'::jsonb))
  LOOP
    v_level    := v_row->>'level';
    v_slot     := v_row->>'slot';
    v_language := v_row->>'language';
    v_key      := v_row->>'reference_key';

    IF v_level = 'product' THEN
      IF NOT (v_product_ids ? v_key) THEN
        RAISE EXCEPTION 'Unknown product key "%" referenced from specification', v_key
          USING ERRCODE = 'P0001',
                DETAIL = json_build_object('code', 'unknown_product_key', 'key', v_key, 'sheet', 'Specifications')::text;
      END IF;
      v_ref_id := (v_product_ids->>v_key)::uuid;
    ELSIF v_level = 'characteristic' THEN
      IF NOT (v_char_ids ? v_key) THEN
        RAISE EXCEPTION 'Unknown characteristic key "%" referenced from specification', v_key
          USING ERRCODE = 'P0001',
                DETAIL = json_build_object('code', 'unknown_characteristic_key', 'key', v_key, 'sheet', 'Specifications')::text;
      END IF;
      v_ref_id := (v_char_ids->>v_key)::uuid;
    ELSIF v_level = 'characteristic_value' THEN
      IF NOT (v_value_ids ? v_key) THEN
        RAISE EXCEPTION 'Unknown value key "%" referenced from specification', v_key
          USING ERRCODE = 'P0001',
                DETAIL = json_build_object('code', 'unknown_value_key', 'key', v_key, 'sheet', 'Specifications')::text;
      END IF;
      v_ref_id := (v_value_ids->>v_key)::uuid;
    ELSE
      RAISE EXCEPTION 'Invalid specification level "%"', v_level
        USING ERRCODE = 'P0001',
              DETAIL = json_build_object('code', 'invalid_level', 'sheet', 'Specifications')::text;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.tenant_texts
      WHERE tenant_id    = v_tenant_id
        AND level        = v_level
        AND reference_id = v_ref_id
        AND slot         = v_slot
        AND language     = v_language
        AND sort_order   = COALESCE((v_row->>'sort_order')::int, 0)
    ) THEN
      RAISE EXCEPTION 'Specification already exists for % "%", slot "%", language "%"',
        v_level, v_key, v_slot, v_language
        USING ERRCODE = '23505',
              DETAIL = json_build_object('code', 'conflict', 'sheet', 'Specifications', 'key', v_key, 'slot', v_slot, 'language', v_language)::text;
    END IF;

    INSERT INTO public.tenant_texts
      (tenant_id, level, reference_id, slot, language, sort_order, content)
    VALUES (
      v_tenant_id, v_level, v_ref_id, v_slot, v_language,
      COALESCE((v_row->>'sort_order')::int, 0),
      v_row->>'content'
    );
    v_specs_created := v_specs_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'classes_created',         v_classes_created,
    'characteristics_created', v_chars_created,
    'values_created',          v_values_created,
    'products_created',        v_products_created,
    'translations_created',    v_translations_created,
    'texts_created',           v_texts_created,
    'specifications_created',  v_specs_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_catalog(jsonb) TO authenticated;
