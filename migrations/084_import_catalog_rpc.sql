-- Migration 084: import_catalog RPC for bulk Excel uploads.
--
-- Single PL/pgSQL function that accepts the parsed workbook as a JSONB
-- payload and inserts everything (classes, characteristics, values, products,
-- texts) inside one implicit transaction. Any conflict, lookup failure, or
-- plan-limit violation aborts the whole thing — no half-state.
--
-- Permission model:
--   - SECURITY INVOKER so RLS still applies.
--   - We additionally require both `library` and `products` edit access via
--     auth_can(). RLS would only protect the inserts; this check is the gate
--     so callers without the necessary role get a single clean error rather
--     than a cascade of insert-policy failures.
--
-- Error envelope:
--   Raises EXCEPTION with the structured JSON in DETAIL — same pattern as the
--   plan-limit triggers from migration 062. The Edge Function parses the
--   DETAIL into the response body.

CREATE OR REPLACE FUNCTION public.import_catalog(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.auth_tenant_id();

  -- Maps from user-supplied key → inserted UUID, for cross-sheet lookups.
  v_class_ids    jsonb := '{}'::jsonb;
  v_char_ids     jsonb := '{}'::jsonb;
  v_product_ids  jsonb := '{}'::jsonb;

  v_classes_created         int := 0;
  v_chars_created           int := 0;
  v_values_created          int := 0;
  v_products_created        int := 0;
  v_texts_created           int := 0;

  v_row jsonb;
  v_key text;
  v_id  uuid;
  v_ref_id uuid;
  v_class_keys jsonb;
  v_class_key text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.auth_can('library', 'edit') OR NOT public.auth_can('products', 'edit') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501',
      DETAIL = json_build_object('code', 'forbidden')::text;
  END IF;

  -- ── 1. Classes ───────────────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'classes', '[]'::jsonb))
  LOOP
    v_key := v_row->>'key';

    IF EXISTS (
      SELECT 1 FROM public.characteristic_classes
      WHERE tenant_id = v_tenant_id AND lower(name) = lower(v_row->>'name_en')
    ) THEN
      RAISE EXCEPTION 'Class "%" already exists', v_row->>'name_en'
        USING ERRCODE = '23505',
              DETAIL = json_build_object(
                'code', 'conflict', 'sheet', 'Classes',
                'key',  v_key, 'name', v_row->>'name_en'
              )::text;
    END IF;

    INSERT INTO public.characteristic_classes
      (tenant_id, name, name_i18n, sort_order)
    VALUES (
      v_tenant_id,
      v_row->>'name_en',
      jsonb_strip_nulls(jsonb_build_object(
        'en', v_row->>'name_en',
        'sr', v_row->>'name_sr'
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

    IF EXISTS (
      SELECT 1 FROM public.characteristics
      WHERE tenant_id = v_tenant_id AND lower(name) = lower(v_row->>'name_en')
    ) THEN
      RAISE EXCEPTION 'Characteristic "%" already exists', v_row->>'name_en'
        USING ERRCODE = '23505',
              DETAIL = json_build_object(
                'code', 'conflict', 'sheet', 'Characteristics',
                'key',  v_key, 'name', v_row->>'name_en'
              )::text;
    END IF;

    INSERT INTO public.characteristics
      (tenant_id, name, display_type, sort_order)
    VALUES (
      v_tenant_id,
      v_row->>'name_en',
      (v_row->>'display_type')::text,
      COALESCE((v_row->>'sort_order')::int, v_chars_created)
    )
    RETURNING id INTO v_id;

    v_char_ids := jsonb_set(v_char_ids, ARRAY[v_key], to_jsonb(v_id::text));
    v_chars_created := v_chars_created + 1;

    -- Inline EN/SR name + description go into tenant_texts.
    IF v_row->>'name_en' IS NOT NULL THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'characteristic', v_id, 'name', 'en', 0, v_row->>'name_en');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'name_sr' IS NOT NULL AND length(v_row->>'name_sr') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'characteristic', v_id, 'name', 'sr', 0, v_row->>'name_sr');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'description_en' IS NOT NULL AND length(v_row->>'description_en') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'characteristic', v_id, 'description', 'en', 0, v_row->>'description_en');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'description_sr' IS NOT NULL AND length(v_row->>'description_sr') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'characteristic', v_id, 'description', 'sr', 0, v_row->>'description_sr');
      v_texts_created := v_texts_created + 1;
    END IF;

    -- Link to classes via the M:N junction.
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
        AND lower(label) = lower(v_row->>'label_en')
    ) THEN
      RAISE EXCEPTION 'Value "%" already exists for that characteristic', v_row->>'label_en'
        USING ERRCODE = '23505',
              DETAIL = json_build_object(
                'code', 'conflict', 'sheet', 'Values',
                'key',  v_key, 'name', v_row->>'label_en'
              )::text;
    END IF;

    INSERT INTO public.characteristic_values
      (characteristic_id, tenant_id, label, price_modifier, sort_order, hex_color)
    VALUES (
      v_ref_id,
      v_tenant_id,
      v_row->>'label_en',
      COALESCE((v_row->>'price_modifier')::numeric, 0),
      COALESCE((v_row->>'sort_order')::int, v_values_created),
      NULLIF(v_row->>'hex_color', '')
    )
    RETURNING id INTO v_id;

    v_values_created := v_values_created + 1;

    IF v_row->>'label_en' IS NOT NULL THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'characteristic_value', v_id, 'label', 'en', 0, v_row->>'label_en');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'label_sr' IS NOT NULL AND length(v_row->>'label_sr') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'characteristic_value', v_id, 'label', 'sr', 0, v_row->>'label_sr');
      v_texts_created := v_texts_created + 1;
    END IF;
  END LOOP;

  -- ── 4. Products ──────────────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'products', '[]'::jsonb))
  LOOP
    v_key := v_row->>'key';

    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE tenant_id = v_tenant_id AND lower(name) = lower(v_row->>'name_en')
    ) THEN
      RAISE EXCEPTION 'Product "%" already exists', v_row->>'name_en'
        USING ERRCODE = '23505',
              DETAIL = json_build_object(
                'code', 'conflict', 'sheet', 'Products',
                'key',  v_key, 'name', v_row->>'name_en'
              )::text;
    END IF;

    INSERT INTO public.products
      (tenant_id, name, description, base_price, currency, sku, unit_of_measure, status)
    VALUES (
      v_tenant_id,
      v_row->>'name_en',
      NULLIF(v_row->>'description_en', ''),
      COALESCE((v_row->>'base_price')::numeric, 0),
      COALESCE(NULLIF(v_row->>'currency', ''), 'EUR'),
      NULLIF(v_row->>'sku', ''),
      NULLIF(v_row->>'unit_of_measure', ''),
      COALESCE(NULLIF(v_row->>'status', ''), 'draft')
    )
    RETURNING id INTO v_id;

    v_product_ids := jsonb_set(v_product_ids, ARRAY[v_key], to_jsonb(v_id::text));
    v_products_created := v_products_created + 1;

    IF v_row->>'name_en' IS NOT NULL THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'product', v_id, 'name', 'en', 0, v_row->>'name_en');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'name_sr' IS NOT NULL AND length(v_row->>'name_sr') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'product', v_id, 'name', 'sr', 0, v_row->>'name_sr');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'description_en' IS NOT NULL AND length(v_row->>'description_en') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'product', v_id, 'description', 'en', 0, v_row->>'description_en');
      v_texts_created := v_texts_created + 1;
    END IF;
    IF v_row->>'description_sr' IS NOT NULL AND length(v_row->>'description_sr') > 0 THEN
      INSERT INTO public.tenant_texts (tenant_id, level, reference_id, slot, language, sort_order, content)
      VALUES (v_tenant_id, 'product', v_id, 'description', 'sr', 0, v_row->>'description_sr');
      v_texts_created := v_texts_created + 1;
    END IF;

    -- Link to classes via product_classes M:N.
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

  -- ── 5. Tenant-level texts ────────────────────────────────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'texts', '[]'::jsonb))
  LOOP
    -- Conflict check on the natural key. Multi-row slots distinguish by sort_order.
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
              DETAIL = json_build_object(
                'code', 'conflict', 'sheet', 'Texts',
                'slot', v_row->>'slot', 'language', v_row->>'language'
              )::text;
    END IF;

    INSERT INTO public.tenant_texts
      (tenant_id, level, reference_id, slot, language, sort_order, content)
    VALUES (
      v_tenant_id,
      'tenant',
      NULL,
      v_row->>'slot',
      v_row->>'language',
      COALESCE((v_row->>'sort_order')::int, 0),
      v_row->>'content'
    );
    v_texts_created := v_texts_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'classes_created',         v_classes_created,
    'characteristics_created', v_chars_created,
    'values_created',          v_values_created,
    'products_created',        v_products_created,
    'texts_created',           v_texts_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_catalog(jsonb) TO authenticated;
