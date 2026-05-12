-- Migration 074: Richer configuration rules
--
-- Generalise the existing configuration_rules JSONB shapes so a single
-- rule can have:
--   • a flat ALL/ANY list of predicates (select-equality, select-inequality,
--     or a numeric comparison between two arithmetic expressions);
--   • an array of effects, each independently hiding / disabling values
--     or setting / locking defaults on one or more target characteristics.
--
-- The old shape — one trigger, one effect — is migrated row-by-row so
-- behaviour is identical. The old `effect` and `rule_type` columns are
-- dropped at the end.
--
-- New JSONB shapes (TypeScript reference in configurator-admin/src/types/database.ts):
--   condition: { mode: 'all'|'any', predicates: Predicate[] }
--   effects:   RuleEffect[]
-- where:
--   Predicate =
--     | { type:'select_eq';  char_id, value_id }
--     | { type:'select_neq'; char_id, value_id }
--     | { type:'cmp'; op:'gt'|'gte'|'lt'|'lte'|'eq'|'neq';
--                      left:NumExpr; right:NumExpr }
--   NumExpr =
--     | { type:'number'; value }
--     | { type:'input';  char_id }
--     | { type:'arith';  op:'add'|'subtract'|'multiply'|'divide';
--                         left:NumExpr; right:NumExpr }
--   RuleEffect =
--     | { type:'hide_value';          value_id }
--     | { type:'disable_value';       value_id }
--     | { type:'set_value_default';   char_id, value_id }
--     | { type:'set_value_locked';    char_id, value_id }
--     | { type:'set_numeric_default'; char_id, expr:NumExpr }
--     | { type:'set_numeric_locked';  char_id, expr:NumExpr }

BEGIN;

-- 1. Drop the old CHECK constraint so the rewrite below isn't blocked when
--    we wipe rule_type values.
ALTER TABLE public.configuration_rules
  DROP CONSTRAINT IF EXISTS configuration_rules_rule_type_check;

-- 2. Add the new effects column. Default '[]' keeps any future inserts
--    well-formed even if the app misses the column.
ALTER TABLE public.configuration_rules
  ADD COLUMN IF NOT EXISTS effects jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Per-row rewrite. The PL/pgSQL block builds the new condition + effects
--    JSONB from each row's current rule_type + condition + effect.
DO $$
DECLARE
  r           public.configuration_rules%ROWTYPE;
  new_cond    jsonb;
  new_eff     jsonb;
  char_id     text;
  val_id      text;
  num_op      text;
  num_val     numeric;
  eff_char    text;
  eff_val     text;
  eff_num     numeric;
BEGIN
  FOR r IN SELECT * FROM public.configuration_rules LOOP
    char_id := r.condition ->> 'characteristic_id';
    val_id  := r.condition ->> 'value_id';
    num_op  := r.condition ->> 'numeric_op';
    num_val := NULLIF(r.condition ->> 'numeric_value', '')::numeric;

    IF num_op IS NOT NULL THEN
      new_cond := jsonb_build_object(
        'mode', 'all',
        'predicates', jsonb_build_array(
          jsonb_build_object(
            'type', 'cmp',
            'op',   num_op,
            'left', jsonb_build_object('type', 'input',  'char_id', char_id),
            'right', jsonb_build_object('type', 'number', 'value',  num_val)
          )
        )
      );
    ELSE
      new_cond := jsonb_build_object(
        'mode', 'all',
        'predicates', jsonb_build_array(
          jsonb_build_object(
            'type',     'select_eq',
            'char_id',  char_id,
            'value_id', val_id
          )
        )
      );
    END IF;

    eff_char := r.effect ->> 'characteristic_id';
    eff_val  := r.effect ->> 'value_id';
    eff_num  := NULLIF(r.effect ->> 'numeric_value', '')::numeric;

    new_eff := CASE r.rule_type
      WHEN 'hide_value' THEN
        jsonb_build_array(jsonb_build_object('type', 'hide_value', 'value_id', eff_val))
      WHEN 'disable_value' THEN
        jsonb_build_array(jsonb_build_object('type', 'disable_value', 'value_id', eff_val))
      WHEN 'set_value_default' THEN
        CASE WHEN eff_val IS NOT NULL THEN
          jsonb_build_array(jsonb_build_object(
            'type', 'set_value_default', 'char_id', eff_char, 'value_id', eff_val))
        ELSE
          jsonb_build_array(jsonb_build_object(
            'type', 'set_numeric_default', 'char_id', eff_char,
            'expr', jsonb_build_object('type', 'number', 'value', eff_num)))
        END
      WHEN 'set_value_locked' THEN
        CASE WHEN eff_val IS NOT NULL THEN
          jsonb_build_array(jsonb_build_object(
            'type', 'set_value_locked', 'char_id', eff_char, 'value_id', eff_val))
        ELSE
          jsonb_build_array(jsonb_build_object(
            'type', 'set_numeric_locked', 'char_id', eff_char,
            'expr', jsonb_build_object('type', 'number', 'value', eff_num)))
        END
      WHEN 'price_override' THEN
        -- price_override was defined but never exposed in the UI. Surface a
        -- notice so we know if any tenant has one in the wild and skip it.
        '[]'::jsonb
      ELSE '[]'::jsonb
    END;

    IF r.rule_type = 'price_override' THEN
      RAISE NOTICE
        'rules_v2: skipping legacy price_override rule % (no v2 equivalent)',
        r.id;
    END IF;

    UPDATE public.configuration_rules
       SET condition = new_cond,
           effects   = new_eff
     WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Drop the obsolete columns.
ALTER TABLE public.configuration_rules
  DROP COLUMN IF EXISTS rule_type,
  DROP COLUMN IF EXISTS effect;

COMMIT;
