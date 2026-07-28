-- 1. clientes: remove cross-tenant staff policies
DROP POLICY IF EXISTS "Staff can manage clientes" ON public.clientes;
DROP POLICY IF EXISTS "Staff can view clientes" ON public.clientes;

-- 2. empresas: stop realtime broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.empresas;

-- 3. user_roles: remove permissive ALL policy that allowed same-empresa users to modify roles
DROP POLICY IF EXISTS "tenant_isolation_user_roles" ON public.user_roles;

CREATE POLICY "Same empresa can read roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR user_in_same_empresa(user_id)
);

-- Defense in depth: enforce role blacklist on every write path (including edge functions)
CREATE OR REPLACE FUNCTION public.enforce_role_assignment_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('super_admin'::app_role, 'admin'::app_role, 'gestor'::app_role, 'financeiro'::app_role) THEN
    IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Somente super administradores podem atribuir o papel %', NEW.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_assignment_limits ON public.user_roles;
CREATE TRIGGER trg_enforce_role_assignment_limits
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_assignment_limits();