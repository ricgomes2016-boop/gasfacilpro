
-- ============================================
-- SECURITY HARDENING: Fix overly permissive RLS policies
-- ============================================

-- 1. chat_mensagens: INSERT should require sender = current user
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.chat_mensagens;
CREATE POLICY "Users can insert own chat messages"
  ON public.chat_mensagens FOR INSERT TO authenticated
  WITH CHECK (remetente_id = auth.uid());

-- 2. chat_mensagens: UPDATE should be scoped to own messages or recipient
DROP POLICY IF EXISTS "Authenticated users can update chat messages" ON public.chat_mensagens;
CREATE POLICY "Users can update relevant chat messages"
  ON public.chat_mensagens FOR UPDATE TO authenticated
  USING (remetente_id = auth.uid() OR destinatario_id = auth.uid());

-- 3. emprestimos: Replace ALL true with role-based
DROP POLICY IF EXISTS "Auth users manage emprestimos" ON public.emprestimos;
CREATE POLICY "Staff manage emprestimos"
  ON public.emprestimos FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  );

-- 4. entregador_conquistas: INSERT should require staff role
DROP POLICY IF EXISTS "Authenticated can insert entregador_conquistas" ON public.entregador_conquistas;
CREATE POLICY "Staff can insert entregador_conquistas"
  ON public.entregador_conquistas FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'operacional'::app_role) OR
    has_role(auth.uid(), 'entregador'::app_role)
  );

-- 5. fatura_cartao_itens: Replace ALL true with finance roles
DROP POLICY IF EXISTS "Auth users manage fatura_itens" ON public.fatura_cartao_itens;
CREATE POLICY "Finance staff manage fatura_cartao_itens"
  ON public.fatura_cartao_itens FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  );

-- 6. faturas_cartao: Replace ALL true with finance roles
DROP POLICY IF EXISTS "Auth users manage faturas_cartao" ON public.faturas_cartao;
CREATE POLICY "Finance staff manage faturas_cartao"
  ON public.faturas_cartao FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  );

-- 7. empresas: Restrict onboarding INSERT to authenticated admin users
DROP POLICY IF EXISTS "Anyone can insert empresa (onboarding)" ON public.empresas;
CREATE POLICY "Authenticated admin can create empresa"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================
-- SENSITIVE DATA: Restrict access to financial tables
-- ============================================

-- 8. contas_bancarias: Remove entregador SELECT access (they don't need bank details)
DROP POLICY IF EXISTS "Entregador visualiza contas bancárias" ON public.contas_bancarias;

-- 9. boletos_emitidos: Remove operacional SELECT (only finance staff need it)
DROP POLICY IF EXISTS "Staff can view boletos_emitidos" ON public.boletos_emitidos;
CREATE POLICY "Finance staff can view boletos"
  ON public.boletos_emitidos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role)
  );

-- 10. cheques: Remove operacional SELECT  
DROP POLICY IF EXISTS "Operacional visualiza cheques" ON public.cheques;

-- 11. plano_contas: Restrict to admin/gestor/financeiro only
DROP POLICY IF EXISTS "Authenticated users can read plano_contas" ON public.plano_contas;
DROP POLICY IF EXISTS "Auth users read plano_contas" ON public.plano_contas;
CREATE POLICY "Finance staff can read plano_contas"
  ON public.plano_contas FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );
