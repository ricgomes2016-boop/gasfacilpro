-- RLS para buckets do portal contador
-- Estrutura de path: {empresa_id}/{unidade_id?}/{filename}

-- Helper: verifica se user tem acesso ao bucket via empresa_id no path
CREATE OR REPLACE FUNCTION public.user_can_access_contabil_path(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_first text;
BEGIN
  v_first := split_part(_path, '/', 1);
  IF v_first = '' THEN RETURN false; END IF;
  BEGIN
    v_empresa_id := v_first::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.contador_has_empresa(auth.uid(), v_empresa_id)
    OR (public.get_user_empresa_id() = v_empresa_id
        AND (public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'gestor'::app_role)
             OR public.has_role(auth.uid(), 'financeiro'::app_role)));
END;
$$;

-- XMLs
DROP POLICY IF EXISTS "contabil_xmls_select" ON storage.objects;
DROP POLICY IF EXISTS "contabil_xmls_insert" ON storage.objects;
DROP POLICY IF EXISTS "contabil_xmls_delete" ON storage.objects;
CREATE POLICY "contabil_xmls_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contabil-xmls' AND public.user_can_access_contabil_path(name));
CREATE POLICY "contabil_xmls_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contabil-xmls' AND public.user_can_access_contabil_path(name));
CREATE POLICY "contabil_xmls_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contabil-xmls' AND public.user_can_access_contabil_path(name));

-- Despesas
DROP POLICY IF EXISTS "contabil_despesas_select" ON storage.objects;
DROP POLICY IF EXISTS "contabil_despesas_insert" ON storage.objects;
DROP POLICY IF EXISTS "contabil_despesas_delete" ON storage.objects;
CREATE POLICY "contabil_despesas_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contabil-despesas' AND public.user_can_access_contabil_path(name));
CREATE POLICY "contabil_despesas_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contabil-despesas' AND public.user_can_access_contabil_path(name));
CREATE POLICY "contabil_despesas_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contabil-despesas' AND public.user_can_access_contabil_path(name));

-- Extratos
DROP POLICY IF EXISTS "contabil_extratos_select" ON storage.objects;
DROP POLICY IF EXISTS "contabil_extratos_insert" ON storage.objects;
DROP POLICY IF EXISTS "contabil_extratos_delete" ON storage.objects;
CREATE POLICY "contabil_extratos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contabil-extratos' AND public.user_can_access_contabil_path(name));
CREATE POLICY "contabil_extratos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contabil-extratos' AND public.user_can_access_contabil_path(name));
CREATE POLICY "contabil_extratos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contabil-extratos' AND public.user_can_access_contabil_path(name));