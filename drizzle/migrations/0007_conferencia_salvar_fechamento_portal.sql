CREATE FUNCTION public.salvar_fechamento_conferencia_portal(_user_id uuid,_empresa_id uuid,_data date,_data_contagem date,_momento text,_registros jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 IF _momento IS NULL OR _data IS NULL OR _data_contagem IS NULL OR _momento NOT IN ('inicio','fim') OR _data <> (CASE WHEN _momento='inicio' THEN _data_contagem-1 ELSE _data_contagem END) THEN RAISE EXCEPTION 'Datas invalidas'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.estoque_conferente_acessos WHERE user_id=_user_id AND empresa_id=_empresa_id AND ativo) THEN RAISE EXCEPTION 'Acesso indisponivel'; END IF;
 IF jsonb_typeof(_registros) IS DISTINCT FROM 'array' OR jsonb_array_length(_registros)=0 THEN RAISE EXCEPTION 'Contagem invalida'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_registros) LOOP
 IF NOT EXISTS (SELECT 1 FROM public.estoque_conferente_unidades a JOIN public.unidades u ON u.id=a.unidade_id AND u.empresa_id=a.empresa_id WHERE a.user_id=_user_id AND a.empresa_id=_empresa_id AND a.unidade_id=(r->>'unidade_id')::uuid AND u.ativo) THEN RAISE EXCEPTION 'Loja nao autorizada'; END IF;
 IF (r->>'quantidade')::numeric <> trunc((r->>'quantidade')::numeric) THEN RAISE EXCEPTION 'Contagem invalida'; END IF;
 INSERT INTO public.estoque_conferencia_fechamentos (data_conferencia,data_contagem,momento,unidade_id,empresa_id,produto_grupo,tipo_estoque,quantidade,conferido_por)
 VALUES (_data,_data_contagem,_momento,(r->>'unidade_id')::uuid,_empresa_id,r->>'produto_grupo',r->>'tipo_estoque',(r->>'quantidade')::integer,_user_id)
 ON CONFLICT (data_conferencia,unidade_id,produto_grupo,tipo_estoque) DO UPDATE SET quantidade=EXCLUDED.quantidade,data_contagem=EXCLUDED.data_contagem,momento=EXCLUDED.momento,conferido_por=EXCLUDED.conferido_por,updated_at=now();
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.salvar_fechamento_conferencia_portal(uuid,uuid,date,date,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_fechamento_conferencia_portal(uuid,uuid,date,date,text,jsonb) TO service_role;