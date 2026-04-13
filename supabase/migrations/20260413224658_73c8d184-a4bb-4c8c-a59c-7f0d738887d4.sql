DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'canais_venda'
      AND policyname = 'Entregadores can view canais_venda'
  ) THEN
    CREATE POLICY "Entregadores can view canais_venda"
    ON public.canais_venda
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'entregador'::public.app_role));
  END IF;
END
$$;