
-- 1) cliente_enderecos: escopo do entregador limitado aos pedidos atribuídos
CREATE OR REPLACE FUNCTION public.entregador_pode_ver_cliente(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pedidos p
    JOIN public.entregadores e ON e.id = p.entregador_id
    WHERE p.cliente_id = _cliente_id
      AND e.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Staff can read addresses of empresa clients" ON public.cliente_enderecos;

CREATE POLICY "Staff can read addresses of empresa clients"
ON public.cliente_enderecos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
      OR has_role(auth.uid(), 'operacional'::app_role))
    AND cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.empresa_id = get_user_empresa_id())
  )
  OR (
    has_role(auth.uid(), 'entregador'::app_role)
    AND cliente_id IS NOT NULL
    AND cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.empresa_id = get_user_empresa_id())
    AND public.entregador_pode_ver_cliente(cliente_id)
  )
);

-- 2) Bucket privado para fotos de cheques
CREATE POLICY "Equipe pode ler fotos de cheques"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cheques-docs');

CREATE POLICY "Equipe pode enviar fotos de cheques"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cheques-docs');

CREATE POLICY "Equipe pode atualizar fotos de cheques"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cheques-docs');

CREATE POLICY "Equipe pode remover fotos de cheques"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cheques-docs');

-- 3) user_roles: checagem explícita de empresa no momento da escrita (defesa em profundidade)
CREATE OR REPLACE FUNCTION public.enforce_role_assignment_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_empresa uuid;
  v_target_empresa uuid;
BEGIN
  IF NEW.role IN ('super_admin'::app_role, 'admin'::app_role, 'gestor'::app_role, 'financeiro'::app_role) THEN
    IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Somente super administradores podem atribuir o papel %', NEW.role;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    SELECT empresa_id INTO v_actor_empresa FROM public.profiles WHERE id = auth.uid();
    SELECT empresa_id INTO v_target_empresa FROM public.profiles WHERE id = NEW.user_id;

    IF v_actor_empresa IS NULL OR v_target_empresa IS NULL OR v_actor_empresa <> v_target_empresa THEN
      RAISE EXCEPTION 'Não é permitido atribuir papéis a usuários de outra empresa';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
