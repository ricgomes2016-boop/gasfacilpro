CREATE OR REPLACE FUNCTION public.can_manage_transporte(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','gestor','financeiro','super_admin','transportadora')
  )
$$;

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['transp_compras','transp_veiculos','transp_despesas','transp_entregas','transp_fechamentos','transp_funcionarios','transp_simulacoes','transp_abastecimentos','transp_rotas_atacado','transp_rota_paradas'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE t text; scope text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transp_compras','transp_veiculos','transp_despesas','transp_entregas','transp_fechamentos','transp_funcionarios','transp_simulacoes','transp_abastecimentos','transp_rotas_atacado'] LOOP
    scope := 'empresa_id = public.get_user_empresa_id() AND public.can_manage_transporte(auth.uid())';
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t||'_select', t, scope);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t||'_insert', t, scope);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t||'_update', t, scope, scope);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t||'_delete', t, scope);
  END LOOP;
END $$;

CREATE POLICY transp_rota_paradas_select ON public.transp_rota_paradas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.transp_rotas_atacado r WHERE r.id = transp_rota_paradas.rota_id AND r.empresa_id = public.get_user_empresa_id()) AND public.can_manage_transporte(auth.uid()));
CREATE POLICY transp_rota_paradas_insert ON public.transp_rota_paradas FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.transp_rotas_atacado r WHERE r.id = transp_rota_paradas.rota_id AND r.empresa_id = public.get_user_empresa_id()) AND public.can_manage_transporte(auth.uid()));
CREATE POLICY transp_rota_paradas_update ON public.transp_rota_paradas FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.transp_rotas_atacado r WHERE r.id = transp_rota_paradas.rota_id AND r.empresa_id = public.get_user_empresa_id()) AND public.can_manage_transporte(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.transp_rotas_atacado r WHERE r.id = transp_rota_paradas.rota_id AND r.empresa_id = public.get_user_empresa_id()) AND public.can_manage_transporte(auth.uid()));
CREATE POLICY transp_rota_paradas_delete ON public.transp_rota_paradas FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.transp_rotas_atacado r WHERE r.id = transp_rota_paradas.rota_id AND r.empresa_id = public.get_user_empresa_id()) AND public.can_manage_transporte(auth.uid()));