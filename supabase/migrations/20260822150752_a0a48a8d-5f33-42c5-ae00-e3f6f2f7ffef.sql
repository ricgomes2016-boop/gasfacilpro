UPDATE public.escalas_entregador e
SET unidade_id = en.unidade_id
FROM public.entregadores en
WHERE e.unidade_id IS NULL AND en.id = e.entregador_id AND en.unidade_id IS NOT NULL;

UPDATE public.horarios_funcionario h
SET unidade_id = f.unidade_id
FROM public.funcionarios f
WHERE h.unidade_id IS NULL AND f.id = h.funcionario_id AND f.unidade_id IS NOT NULL;

UPDATE public.horarios_funcionario h
SET unidade_id = en.unidade_id
FROM public.entregadores en
WHERE h.unidade_id IS NULL AND en.id = h.entregador_id AND en.unidade_id IS NOT NULL;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'operadoras_cartao','promocoes','cupons_desconto','fidelidade_clientes',
    'vale_gas_parceiros','vale_gas_lotes','emprestimos','faturas_cartao',
    'escalas_entregador','horarios_funcionario','gamificacao_ranking',
    'vales_funcionario','contratos_recorrentes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_' || t, t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (
        has_role(auth.uid(), 'super_admin'::app_role)
        OR unidade_belongs_to_user_empresa(unidade_id)
      )
      WITH CHECK (
        has_role(auth.uid(), 'super_admin'::app_role)
        OR unidade_belongs_to_user_empresa(unidade_id)
      )
    $f$, 'tenant_isolation_' || t, t);
  END LOOP;
END $$;