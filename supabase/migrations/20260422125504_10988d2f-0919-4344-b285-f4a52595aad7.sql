-- Allow contadores (accountants) to manage extrato_bancario and contas_bancarias
-- for the companies they are linked to via contador_empresas.

-- extrato_bancario policies
DROP POLICY IF EXISTS "Contadores podem ver extratos das empresas vinculadas" ON public.extrato_bancario;
CREATE POLICY "Contadores podem ver extratos das empresas vinculadas"
ON public.extrato_bancario
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = extrato_bancario.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);

DROP POLICY IF EXISTS "Contadores podem inserir extratos das empresas vinculadas" ON public.extrato_bancario;
CREATE POLICY "Contadores podem inserir extratos das empresas vinculadas"
ON public.extrato_bancario
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = extrato_bancario.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);

DROP POLICY IF EXISTS "Contadores podem atualizar extratos das empresas vinculadas" ON public.extrato_bancario;
CREATE POLICY "Contadores podem atualizar extratos das empresas vinculadas"
ON public.extrato_bancario
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = extrato_bancario.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = extrato_bancario.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);

-- contas_bancarias policies
DROP POLICY IF EXISTS "Contadores podem ver contas bancarias das empresas vinculadas" ON public.contas_bancarias;
CREATE POLICY "Contadores podem ver contas bancarias das empresas vinculadas"
ON public.contas_bancarias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = contas_bancarias.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);

DROP POLICY IF EXISTS "Contadores podem inserir contas bancarias das empresas vinculadas" ON public.contas_bancarias;
CREATE POLICY "Contadores podem inserir contas bancarias das empresas vinculadas"
ON public.contas_bancarias
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = contas_bancarias.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);