CREATE OR REPLACE FUNCTION public.user_can_access_dfe_path(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade_id uuid;
BEGIN
  IF split_part(_path, '/', 1) <> 'dfe' THEN RETURN false; END IF;
  BEGIN
    v_unidade_id := split_part(_path, '/', 2)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.has_role(auth.uid(), 'super_admin'::app_role)
     OR v_unidade_id = ANY (public.get_user_unidade_ids());
END;
$$;

DROP POLICY IF EXISTS "contabil_xmls_dfe_select" ON storage.objects;
CREATE POLICY "contabil_xmls_dfe_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contabil-xmls' AND public.user_can_access_dfe_path(name));