DROP POLICY IF EXISTS "Contador vê seus próprios vínculos" ON public.contador_empresas;
CREATE POLICY "Contador vê seus próprios vínculos"
ON public.contador_empresas FOR SELECT TO authenticated
USING (
  contador_user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id())
);