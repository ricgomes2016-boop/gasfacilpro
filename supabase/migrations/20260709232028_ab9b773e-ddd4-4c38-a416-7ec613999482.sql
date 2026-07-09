
-- 1) plano_modulos: restringir leitura a admin/gestor/super_admin
DROP POLICY IF EXISTS "Authenticated with role can read plano_modulos" ON public.plano_modulos;
CREATE POLICY "Admin/gestor can read plano_modulos"
  ON public.plano_modulos
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  );

-- 2) contas_pix_chaves: adicionar RESTRICTIVE tenant backstop
DROP POLICY IF EXISTS contas_pix_chaves_tenant_restrict ON public.contas_pix_chaves;
CREATE POLICY contas_pix_chaves_tenant_restrict
  ON public.contas_pix_chaves
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.unidade_belongs_to_user_empresa(unidade_id)
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = contas_pix_chaves.unidade_id
        AND public.contador_has_empresa(auth.uid(), u.empresa_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  );

-- 3) chat_mensagens: envio como 'base' restrito a unidade atribuída ao usuário
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_mensagens;
CREATE POLICY "Users can insert own chat messages"
  ON public.chat_mensagens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Mensagem em nome do próprio usuário
    remetente_id = auth.uid()
    -- Entregador enviando pelo próprio registro
    OR remetente_id IN (
      SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid()
    )
    -- Base (unidade) enviando: usuário precisa estar realmente atribuído à unidade,
    -- OU ser admin/gestor da empresa dona da unidade.
    OR (
      remetente_tipo = 'base'
      AND (
        public.has_role(auth.uid(), 'super_admin'::public.app_role)
        OR (
          public.unidade_belongs_to_user_empresa(remetente_id)
          AND (
            public.has_role(auth.uid(), 'admin'::public.app_role)
            OR public.has_role(auth.uid(), 'gestor'::public.app_role)
            OR EXISTS (
              SELECT 1 FROM public.user_unidades uu
              WHERE uu.user_id = auth.uid()
                AND uu.unidade_id = remetente_id
            )
          )
        )
      )
    )
  );
