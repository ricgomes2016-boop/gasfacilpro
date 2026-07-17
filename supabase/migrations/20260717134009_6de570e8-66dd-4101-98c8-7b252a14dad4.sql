
-- 1) cliente_creditos: restrict to authenticated (preserve original USING logic)
DROP POLICY IF EXISTS "Clientes can view their own credits" ON public.cliente_creditos;
CREATE POLICY "Clientes can view their own credits"
ON public.cliente_creditos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.clientes c ON (
      (u.email_confirmed_at IS NOT NULL AND c.email IS NOT NULL AND u.email IS NOT NULL AND lower(c.email) = lower(u.email::text))
      OR (u.phone_confirmed_at IS NOT NULL AND c.telefone IS NOT NULL AND u.phone IS NOT NULL AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g'))
    )
    WHERE u.id = auth.uid()
      AND c.id = cliente_creditos.cliente_id
  )
);

-- 2) cliente_indicacoes: restrict to authenticated (preserve original USING logic)
DROP POLICY IF EXISTS "Clientes can view their own referrals" ON public.cliente_indicacoes;
CREATE POLICY "Clientes can view their own referrals"
ON public.cliente_indicacoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.clientes c ON (
      (u.email_confirmed_at IS NOT NULL AND c.email IS NOT NULL AND u.email IS NOT NULL AND lower(c.email) = lower(u.email::text))
      OR (u.phone_confirmed_at IS NOT NULL AND c.telefone IS NOT NULL AND u.phone IS NOT NULL AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g'))
    )
    WHERE u.id = auth.uid()
      AND c.id = ANY (ARRAY[cliente_indicacoes.indicador_cliente_id, cliente_indicacoes.indicado_cliente_id])
  )
);

-- 3) recompra_dispatches: add permissive policies (restrictive tenant_isolation already exists)
CREATE POLICY "Staff can view recompra dispatches"
ON public.recompra_dispatches
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
);

CREATE POLICY "Staff can insert recompra dispatches"
ON public.recompra_dispatches
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
);

CREATE POLICY "Service role manages recompra dispatches"
ON public.recompra_dispatches
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4) whatsapp_eventos: add tenant_isolation restrictive + update/delete for staff
CREATE POLICY "tenant_isolation_whatsapp_eventos"
ON public.whatsapp_eventos
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR empresa_id = public.get_user_empresa_id()
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR empresa_id = public.get_user_empresa_id()
);

CREATE POLICY "Staff can update whatsapp eventos"
ON public.whatsapp_eventos
FOR UPDATE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id()
);

CREATE POLICY "Staff can delete whatsapp eventos"
ON public.whatsapp_eventos
FOR DELETE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  )
);
