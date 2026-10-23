CREATE TABLE public.estoque_conferente_acessos (
 user_id uuid PRIMARY KEY,
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 role text NOT NULL DEFAULT 'conferente' CHECK (role = 'conferente'),
 ativo boolean NOT NULL DEFAULT true,
 criado_por uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.estoque_conferente_acessos TO authenticated;
GRANT ALL ON public.estoque_conferente_acessos TO service_role;
ALTER TABLE public.estoque_conferente_acessos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conferente consulta proprio acesso" ON public.estoque_conferente_acessos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.estoque_conferente_unidades (
 user_id uuid NOT NULL REFERENCES public.estoque_conferente_acessos(user_id) ON DELETE CASCADE,
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 PRIMARY KEY (user_id, unidade_id)
);
GRANT SELECT ON public.estoque_conferente_unidades TO authenticated;
GRANT ALL ON public.estoque_conferente_unidades TO service_role;
ALTER TABLE public.estoque_conferente_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conferente consulta lojas autorizadas" ON public.estoque_conferente_unidades FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.salvar_contagem_portal(_user_id uuid, _empresa_id uuid, _data date, _registros jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.estoque_conferente_acessos WHERE user_id=_user_id AND empresa_id=_empresa_id AND ativo) THEN RAISE EXCEPTION 'Acesso indisponivel'; END IF;
 IF jsonb_array_length(_registros) = 0 THEN RAISE EXCEPTION 'Nenhuma contagem'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_registros) LOOP
  IF NOT EXISTS (SELECT 1 FROM public.estoque_conferente_unidades a JOIN public.unidades u ON u.id=a.unidade_id AND u.empresa_id=a.empresa_id WHERE a.user_id=_user_id AND a.empresa_id=_empresa_id AND a.unidade_id=(r->>'unidade_id')::uuid AND u.ativo) THEN RAISE EXCEPTION 'Loja nao autorizada'; END IF;
  IF r->>'produto_grupo' NOT IN ('P13','P20','P45','Agua') OR r->>'tipo_estoque' NOT IN ('cheio','vazio') OR (r->>'quantidade')::numeric < 0 OR (r->>'quantidade')::numeric <> trunc((r->>'quantidade')::numeric) THEN RAISE EXCEPTION 'Contagem invalida'; END IF;
  INSERT INTO public.estoque_conferencias (data_conferencia, unidade_id, produto_grupo, tipo_estoque, quantidade, conferido_por)
  VALUES (_data,(r->>'unidade_id')::uuid,r->>'produto_grupo',r->>'tipo_estoque',(r->>'quantidade')::integer,_user_id)
  ON CONFLICT (data_conferencia,unidade_id,produto_grupo,tipo_estoque) DO UPDATE SET quantidade=EXCLUDED.quantidade,conferido_por=EXCLUDED.conferido_por,updated_at=now();
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_contagem_portal(uuid,uuid,date,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_contagem_portal(uuid,uuid,date,jsonb) TO service_role;