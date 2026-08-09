CREATE OR REPLACE FUNCTION public.avatar_object_belongs_to_empresa(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first text := (storage.foldername(_object_name))[1];
  _caller_empresa uuid := public.get_user_empresa_id();
  _entregador_id uuid;
  _file text;
BEGIN
  IF _caller_empresa IS NULL THEN
    RETURN false;
  END IF;

  IF _first = 'entregadores' THEN
    _file := split_part(_object_name, '/', 2);
    BEGIN
      _entregador_id := substring(_file from 1 for 36)::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;

    RETURN EXISTS (
      SELECT 1
      FROM public.entregadores e
      JOIN public.unidades u ON u.id = e.unidade_id
      WHERE e.id = _entregador_id
        AND u.empresa_id = _caller_empresa
    );
  END IF;

  -- Pasta nomeada com o uuid do usuário dono do avatar
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _first::uuid
        AND p.empresa_id = _caller_empresa
    );
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$;

DROP POLICY IF EXISTS "Authenticated can read own or staff avatars" ON storage.objects;
CREATE POLICY "Authenticated can read own or staff avatars"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gestor'::app_role)
        OR has_role(auth.uid(), 'operacional'::app_role)
        OR has_role(auth.uid(), 'financeiro'::app_role)
      )
      AND public.avatar_object_belongs_to_empresa(name)
    )
  )
);

DROP POLICY IF EXISTS "Staff manage entregador avatars insert" ON storage.objects;
CREATE POLICY "Staff manage entregador avatars insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'entregadores'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gestor'::app_role)
        OR has_role(auth.uid(), 'operacional'::app_role)
      )
      AND public.avatar_object_belongs_to_empresa(name)
    )
  )
);

DROP POLICY IF EXISTS "Staff manage entregador avatars update" ON storage.objects;
CREATE POLICY "Staff manage entregador avatars update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'entregadores'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gestor'::app_role)
        OR has_role(auth.uid(), 'operacional'::app_role)
      )
      AND public.avatar_object_belongs_to_empresa(name)
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'entregadores'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR public.avatar_object_belongs_to_empresa(name)
  )
);

DROP POLICY IF EXISTS "Staff manage entregador avatars delete" ON storage.objects;
CREATE POLICY "Staff manage entregador avatars delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'entregadores'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gestor'::app_role)
        OR has_role(auth.uid(), 'operacional'::app_role)
      )
      AND public.avatar_object_belongs_to_empresa(name)
    )
  )
);