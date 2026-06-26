DROP POLICY IF EXISTS "Admin/Gestor can manage unidades" ON public.unidades;

CREATE POLICY "Admin/Gestor can manage own empresa unidades"
  ON public.unidades
  FOR ALL TO authenticated
  USING (
    empresa_id = get_user_empresa_id()
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
  )
  WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
  );