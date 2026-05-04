-- 051_pricing_widget_read.sql
-- Allow the widget (anon key) to read active price schedules and modifier
-- schedules so it can display scheduled prices to customers.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_price_schedules'
      AND policyname = 'product_price_schedules: anon read') THEN
    EXECUTE $p$
      CREATE POLICY "product_price_schedules: anon read"
        ON public.product_price_schedules FOR SELECT TO anon USING (true);
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'characteristic_modifier_schedules'
      AND policyname = 'characteristic_modifier_schedules: anon read') THEN
    EXECUTE $p$
      CREATE POLICY "characteristic_modifier_schedules: anon read"
        ON public.characteristic_modifier_schedules FOR SELECT TO anon USING (true);
    $p$;
  END IF;
END;
$$;
