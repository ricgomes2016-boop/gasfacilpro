-- Permite que contadores (vinculados via contador_empresas) leiam unidades das empresas que atendem
CREATE POLICY "Contadores can view assigned empresa unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (
  public.contador_has_empresa(auth.uid(), empresa_id)
);