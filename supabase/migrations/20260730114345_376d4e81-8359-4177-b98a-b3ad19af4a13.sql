
-- 1) clientes: restrict to user's unidades (staff without unidade assignment or admin/gestor keep full empresa scope)
CREATE POLICY "clientes_unidade_scope" ON public.clientes
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR NOT EXISTS (SELECT 1 FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.cliente_unidades cu
    JOIN public.user_unidades uu ON uu.unidade_id = cu.unidade_id
    WHERE cu.cliente_id = clientes.id AND uu.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR NOT EXISTS (SELECT 1 FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.cliente_unidades cu
    JOIN public.user_unidades uu ON uu.unidade_id = cu.unidade_id
    WHERE cu.cliente_id = clientes.id AND uu.user_id = auth.uid()
  )
);

-- 2) profiles: empresa_id immutable except for super_admin / service role
CREATE OR REPLACE FUNCTION public.prevent_profile_empresa_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Somente super_admin pode alterar a empresa de um usuário';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_empresa_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_empresa_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_empresa_change();

-- 3) whatsapp_gateway_instances: restrictive tenant isolation
CREATE POLICY "tenant_isolation_whatsapp_gateway_instances" ON public.whatsapp_gateway_instances
AS RESTRICTIVE
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id())
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id());

-- 4) realtime: stop broadcasting sensitive tables that are not consumed via realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.pagamentos_cartao;
ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_gateway_instances;
