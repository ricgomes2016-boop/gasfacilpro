
-- 1) conquistas: drop the permissive "true" SELECT policy; keep empresa-scoped policy + RESTRICTIVE tenant isolation
DROP POLICY IF EXISTS "Anyone can read conquistas" ON public.conquistas;

-- 2) plano_modulos: replace permissive-all read with authenticated-users-with-assigned-role only
DROP POLICY IF EXISTS "Authenticated can read plano_modulos" ON public.plano_modulos;
DROP POLICY IF EXISTS "plano_modulos_select_authenticated" ON public.plano_modulos;

CREATE POLICY "Authenticated with role can read plano_modulos"
  ON public.plano_modulos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

-- 3) cliente_precos_negociados: prevent empresa_id from being changed on UPDATE (cross-tenant move guard)
CREATE OR REPLACE FUNCTION public.prevent_precos_empresa_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'Não é permitido alterar empresa_id de cliente_precos_negociados';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_precos_empresa_change ON public.cliente_precos_negociados;
CREATE TRIGGER trg_prevent_precos_empresa_change
  BEFORE UPDATE ON public.cliente_precos_negociados
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_precos_empresa_change();
