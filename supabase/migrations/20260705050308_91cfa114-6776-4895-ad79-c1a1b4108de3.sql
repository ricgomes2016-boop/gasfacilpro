
-- Helper: contador tem acesso a uma unidade via contador_empresas
CREATE OR REPLACE FUNCTION public.contador_can_access_unidade(_unidade_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unidades u
    JOIN public.contador_empresas ce ON ce.empresa_id = u.empresa_id
    WHERE u.id = _unidade_id
      AND ce.contador_user_id = auth.uid()
      AND ce.ativo = true
  );
$$;

-- ============= documentos_contabeis =============
DROP POLICY IF EXISTS "Contador can view documents" ON public.documentos_contabeis;
DROP POLICY IF EXISTS "Contador can insert documents" ON public.documentos_contabeis;
DROP POLICY IF EXISTS "Contador can update documents" ON public.documentos_contabeis;

CREATE POLICY "Contador can view documents"
ON public.documentos_contabeis FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

CREATE POLICY "Contador can insert documents"
ON public.documentos_contabeis FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

CREATE POLICY "Contador can update documents"
ON public.documentos_contabeis FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id))
WITH CHECK (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

-- ============= comunicados_contador =============
DROP POLICY IF EXISTS "Contador can view comunicados" ON public.comunicados_contador;
DROP POLICY IF EXISTS "Contador can insert comunicados" ON public.comunicados_contador;
DROP POLICY IF EXISTS "Contador can update comunicados" ON public.comunicados_contador;

CREATE POLICY "Contador can view comunicados"
ON public.comunicados_contador FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

CREATE POLICY "Contador can insert comunicados"
ON public.comunicados_contador FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

CREATE POLICY "Contador can update comunicados"
ON public.comunicados_contador FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id))
WITH CHECK (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

-- ============= solicitacoes_contador =============
DROP POLICY IF EXISTS "Contador can view solicitacoes" ON public.solicitacoes_contador;
DROP POLICY IF EXISTS "Contador can insert solicitacoes" ON public.solicitacoes_contador;
DROP POLICY IF EXISTS "Contador can update solicitacoes" ON public.solicitacoes_contador;

CREATE POLICY "Contador can view solicitacoes"
ON public.solicitacoes_contador FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

CREATE POLICY "Contador can insert solicitacoes"
ON public.solicitacoes_contador FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

CREATE POLICY "Contador can update solicitacoes"
ON public.solicitacoes_contador FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id))
WITH CHECK (has_role(auth.uid(), 'contador'::app_role) AND public.contador_can_access_unidade(unidade_id));

-- ============= chat_mensagens (contador) =============
-- Restringe contador a ver/enviar apenas suas próprias mensagens (onde ele mesmo é remetente ou destinatário)
DROP POLICY IF EXISTS "Contador can view chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Contador can send chat messages" ON public.chat_mensagens;

CREATE POLICY "Contador can view chat messages"
ON public.chat_mensagens FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'contador'::app_role)
  AND (
    (remetente_tipo = 'contador'::text AND remetente_id = auth.uid())
    OR (destinatario_tipo = 'contador'::text AND destinatario_id = auth.uid())
  )
);

CREATE POLICY "Contador can send chat messages"
ON public.chat_mensagens FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'contador'::app_role)
  AND remetente_tipo = 'contador'::text
  AND remetente_id = auth.uid()
);

-- ============= entregadores (remover PII cross-driver) =============
-- Entregadores não devem enxergar dados sensíveis (CPF, CNH, telefone, localização) dos colegas.
-- A policy "Drivers can view own record" continua permitindo o próprio registro.
DROP POLICY IF EXISTS "Entregador ve colegas da empresa" ON public.entregadores;
