-- Final hardening for SaaS isolation on chat/realtime-adjacent tables.
-- This migration removes older permissive policies that allowed broad
-- authenticated access and makes tenant scope explicit for critical tables.

-- ---------------------------------------------------------------------
-- chat_mensagens: add tenant columns and derive them from sender/receiver.
-- ---------------------------------------------------------------------
ALTER TABLE public.chat_mensagens
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid;

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_empresa_created
  ON public.chat_mensagens (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_unidade_created
  ON public.chat_mensagens (unidade_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_chat_mensagens_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_unidade_id uuid;
BEGIN
  -- Base/operator messages use unidade id as remetente_id or destinatario_id.
  IF NEW.remetente_tipo = 'base' AND NEW.remetente_id IS NOT NULL THEN
    SELECT u.id, u.empresa_id
      INTO v_unidade_id, v_empresa_id
    FROM public.unidades u
    WHERE u.id = NEW.remetente_id;
  END IF;

  IF v_empresa_id IS NULL AND NEW.destinatario_tipo = 'base' AND NEW.destinatario_id IS NOT NULL THEN
    SELECT u.id, u.empresa_id
      INTO v_unidade_id, v_empresa_id
    FROM public.unidades u
    WHERE u.id = NEW.destinatario_id;
  END IF;

  -- Driver messages derive tenant from entregadores.
  IF v_empresa_id IS NULL AND NEW.remetente_tipo = 'entregador' AND NEW.remetente_id IS NOT NULL THEN
    SELECT e.unidade_id, u.empresa_id
      INTO v_unidade_id, v_empresa_id
    FROM public.entregadores e
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE e.id = NEW.remetente_id;
  END IF;

  IF v_empresa_id IS NULL AND NEW.destinatario_tipo = 'entregador' AND NEW.destinatario_id IS NOT NULL THEN
    SELECT e.unidade_id, u.empresa_id
      INTO v_unidade_id, v_empresa_id
    FROM public.entregadores e
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE e.id = NEW.destinatario_id;
  END IF;

  -- User-to-user messages can derive tenant from profile.
  IF v_empresa_id IS NULL AND NEW.remetente_id IS NOT NULL THEN
    SELECT p.empresa_id
      INTO v_empresa_id
    FROM public.profiles p
    WHERE p.user_id = NEW.remetente_id;
  END IF;

  IF v_empresa_id IS NULL AND NEW.destinatario_id IS NOT NULL THEN
    SELECT p.empresa_id
      INTO v_empresa_id
    FROM public.profiles p
    WHERE p.user_id = NEW.destinatario_id;
  END IF;

  NEW.empresa_id := COALESCE(NEW.empresa_id, v_empresa_id);
  NEW.unidade_id := COALESCE(NEW.unidade_id, v_unidade_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_mensagens_set_tenant ON public.chat_mensagens;
CREATE TRIGGER trg_chat_mensagens_set_tenant
  BEFORE INSERT OR UPDATE OF remetente_id, remetente_tipo, destinatario_id, destinatario_tipo
  ON public.chat_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_chat_mensagens_set_tenant();

UPDATE public.chat_mensagens
SET empresa_id = NULL
WHERE empresa_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = chat_mensagens.empresa_id);

UPDATE public.chat_mensagens m
SET empresa_id = COALESCE(m.empresa_id, u.empresa_id),
    unidade_id = COALESCE(m.unidade_id, u.id)
FROM public.unidades u
WHERE (
    (m.remetente_tipo = 'base' AND m.remetente_id = u.id)
    OR (m.destinatario_tipo = 'base' AND m.destinatario_id = u.id)
  )
  AND (m.empresa_id IS NULL OR m.unidade_id IS NULL);

UPDATE public.chat_mensagens m
SET empresa_id = COALESCE(m.empresa_id, u.empresa_id),
    unidade_id = COALESCE(m.unidade_id, e.unidade_id)
FROM public.entregadores e
JOIN public.unidades u ON u.id = e.unidade_id
WHERE (
    (m.remetente_tipo = 'entregador' AND m.remetente_id = e.id)
    OR (m.destinatario_tipo = 'entregador' AND m.destinatario_id = e.id)
  )
  AND (m.empresa_id IS NULL OR m.unidade_id IS NULL);

UPDATE public.chat_mensagens m
SET empresa_id = COALESCE(m.empresa_id, p.empresa_id)
FROM public.profiles p
WHERE (
    m.remetente_id = p.user_id
    OR m.destinatario_id = p.user_id
  )
  AND m.empresa_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Authenticated users can update chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "tenant_isolation_chat_mensagens" ON public.chat_mensagens;
DROP POLICY IF EXISTS "chat_mensagens_tenant_restrict" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Users can update relevant chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Contador can view chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Contador can send chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "Staff can view contador chat" ON public.chat_mensagens;

CREATE POLICY "chat_mensagens_select_scoped"
ON public.chat_mensagens
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR remetente_id = auth.uid()
  OR destinatario_id = auth.uid()
  OR empresa_id = public.get_user_empresa_id()
  OR unidade_id IN (SELECT u.id FROM public.unidades u WHERE u.empresa_id = public.get_user_empresa_id())
  OR remetente_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR destinatario_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR (
    public.has_role(auth.uid(), 'contador'::public.app_role)
    AND (
      remetente_id = auth.uid()
      OR destinatario_id = auth.uid()
      OR (
        empresa_id IS NOT NULL
        AND public.contador_has_empresa(auth.uid(), empresa_id)
      )
    )
  )
);

CREATE POLICY "chat_mensagens_insert_scoped"
ON public.chat_mensagens
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR remetente_id = auth.uid()
  OR remetente_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR (
    remetente_tipo = 'base'
    AND remetente_id IN (SELECT u.id FROM public.unidades u WHERE u.empresa_id = public.get_user_empresa_id())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'operacional'::public.app_role)
    )
  )
  OR (
    remetente_tipo = 'contador'
    AND remetente_id = auth.uid()
    AND public.has_role(auth.uid(), 'contador'::public.app_role)
  )
);

CREATE POLICY "chat_mensagens_update_scoped"
ON public.chat_mensagens
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR remetente_id = auth.uid()
  OR destinatario_id = auth.uid()
  OR empresa_id = public.get_user_empresa_id()
  OR remetente_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR destinatario_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR remetente_id = auth.uid()
  OR destinatario_id = auth.uid()
  OR empresa_id = public.get_user_empresa_id()
);

CREATE POLICY "chat_mensagens_delete_admin_scoped"
ON public.chat_mensagens
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    )
  )
);

DROP POLICY IF EXISTS tenant_isolation_chat_mensagens ON public.chat_mensagens;
CREATE POLICY tenant_isolation_chat_mensagens
ON public.chat_mensagens
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR remetente_id = auth.uid()
  OR destinatario_id = auth.uid()
  OR remetente_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR destinatario_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR empresa_id = public.get_user_empresa_id()
  OR public.contador_has_empresa(auth.uid(), empresa_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR remetente_id = auth.uid()
  OR remetente_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
  OR empresa_id = public.get_user_empresa_id()
  OR public.contador_has_empresa(auth.uid(), empresa_id)
);

-- ---------------------------------------------------------------------
-- ai_conversas / ai_mensagens: make company access explicit and scoped.
-- ---------------------------------------------------------------------
ALTER TABLE public.ai_conversas
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid;

CREATE INDEX IF NOT EXISTS idx_ai_conversas_empresa ON public.ai_conversas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversas_unidade ON public.ai_conversas(unidade_id);

UPDATE public.ai_conversas c
SET empresa_id = p.empresa_id
FROM public.profiles p
WHERE c.empresa_id IS NULL
  AND c.user_id = p.user_id
  AND p.empresa_id IS NOT NULL;

UPDATE public.ai_conversas c
SET empresa_id = u.empresa_id
FROM public.unidades u
WHERE c.empresa_id IS NULL
  AND c.unidade_id = u.id
  AND u.empresa_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_conversas'
      AND column_name = 'telefone'
  ) THEN
    EXECUTE $sql$
      UPDATE public.ai_conversas c
      SET empresa_id = cli.empresa_id
      FROM public.clientes cli
      WHERE c.empresa_id IS NULL
        AND c.telefone IS NOT NULL
        AND cli.telefone IS NOT NULL
        AND cli.empresa_id IS NOT NULL
        AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(cli.telefone, '\D', '', 'g')
    $sql$;
  END IF;
END $$;

DROP POLICY IF EXISTS "tenant_isolation_ai_conversas" ON public.ai_conversas;
DROP POLICY IF EXISTS tenant_isolation_ai_conversas ON public.ai_conversas;

CREATE POLICY tenant_isolation_ai_conversas
ON public.ai_conversas
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR user_id = auth.uid()
  OR (
    empresa_id IS NOT NULL
    AND (
      empresa_id = public.get_user_empresa_id()
      OR public.contador_has_empresa(auth.uid(), empresa_id)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR user_id = auth.uid()
  OR (
    empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa_id()
  )
);

ALTER TABLE public.ai_mensagens
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid;

CREATE INDEX IF NOT EXISTS idx_ai_mensagens_empresa_created
  ON public.ai_mensagens(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_mensagens_unidade_created
  ON public.ai_mensagens(unidade_id, created_at DESC);

UPDATE public.ai_mensagens m
SET empresa_id = c.empresa_id,
    unidade_id = c.unidade_id
FROM public.ai_conversas c
WHERE m.conversa_id = c.id
  AND (m.empresa_id IS NULL OR m.unidade_id IS NULL);

CREATE OR REPLACE FUNCTION public.fn_ai_mensagens_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT c.empresa_id, c.unidade_id
  INTO NEW.empresa_id, NEW.unidade_id
  FROM public.ai_conversas c
  WHERE c.id = NEW.conversa_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_mensagens_set_tenant ON public.ai_mensagens;
CREATE TRIGGER trg_ai_mensagens_set_tenant
BEFORE INSERT OR UPDATE OF conversa_id ON public.ai_mensagens
FOR EACH ROW EXECUTE FUNCTION public.fn_ai_mensagens_set_tenant();

DROP POLICY IF EXISTS "ai_mensagens select tenant" ON public.ai_mensagens;
DROP POLICY IF EXISTS "ai_mensagens insert tenant" ON public.ai_mensagens;
DROP POLICY IF EXISTS "ai_mensagens update tenant" ON public.ai_mensagens;
DROP POLICY IF EXISTS "ai_mensagens delete tenant" ON public.ai_mensagens;
DROP POLICY IF EXISTS "tenant_isolation_ai_mensagens" ON public.ai_mensagens;
DROP POLICY IF EXISTS tenant_isolation_ai_mensagens ON public.ai_mensagens;

CREATE POLICY "ai_mensagens_select_scoped"
ON public.ai_mensagens FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR empresa_id = public.get_user_empresa_id()
  OR public.contador_has_empresa(auth.uid(), empresa_id)
  OR EXISTS (
    SELECT 1
    FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND (
        c.user_id = auth.uid()
        OR c.empresa_id = public.get_user_empresa_id()
        OR public.contador_has_empresa(auth.uid(), c.empresa_id)
      )
  )
);

CREATE POLICY "ai_mensagens_insert_scoped"
ON public.ai_mensagens FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND (
        c.user_id = auth.uid()
        OR c.empresa_id = public.get_user_empresa_id()
      )
  )
);

CREATE POLICY "ai_mensagens_update_scoped"
ON public.ai_mensagens FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR empresa_id = public.get_user_empresa_id()
);

CREATE POLICY "ai_mensagens_delete_admin_scoped"
ON public.ai_mensagens FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    )
  )
);

CREATE POLICY tenant_isolation_ai_mensagens
ON public.ai_mensagens
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR empresa_id = public.get_user_empresa_id()
  OR public.contador_has_empresa(auth.uid(), empresa_id)
  OR EXISTS (
    SELECT 1
    FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND (
        c.user_id = auth.uid()
        OR c.empresa_id = public.get_user_empresa_id()
        OR public.contador_has_empresa(auth.uid(), c.empresa_id)
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR empresa_id = public.get_user_empresa_id()
  OR EXISTS (
    SELECT 1
    FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND (
        c.user_id = auth.uid()
        OR c.empresa_id = public.get_user_empresa_id()
      )
  )
);

-- ---------------------------------------------------------------------
-- Core tables: remove old permissive names that may still exist.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can view entregadores" ON public.entregadores;
DROP POLICY IF EXISTS "Authenticated users can view veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Anyone can view produtos" ON public.produtos;
DROP POLICY IF EXISTS "Authenticated users can view pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated users can insert pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated users can view pedido_itens" ON public.pedido_itens;
DROP POLICY IF EXISTS "Authenticated users can insert pedido_itens" ON public.pedido_itens;
DROP POLICY IF EXISTS "Authenticated users can view rotas" ON public.rotas;
DROP POLICY IF EXISTS "Authenticated users can view rota_historico" ON public.rota_historico;
DROP POLICY IF EXISTS "Users can insert their own route history" ON public.rota_historico;

DROP POLICY IF EXISTS "Entregadores can update pedidos" ON public.pedidos;
CREATE POLICY "Entregadores update own or unassigned unit pedidos"
ON public.pedidos
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'entregador'::public.app_role)
  AND (
    entregador_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
    OR (
      entregador_id IS NULL
      AND status = 'pendente'
      AND unidade_id IN (SELECT e.unidade_id FROM public.entregadores e WHERE e.user_id = auth.uid())
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'entregador'::public.app_role)
  AND (
    entregador_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid())
    OR unidade_id IN (SELECT e.unidade_id FROM public.entregadores e WHERE e.user_id = auth.uid())
  )
);

CREATE POLICY "rota_historico_insert_own_route"
ON public.rota_historico
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR rota_id IN (
    SELECT r.id
    FROM public.rotas r
    JOIN public.entregadores e ON e.id = r.entregador_id
    WHERE e.user_id = auth.uid()
  )
  OR rota_id IN (
    SELECT r.id
    FROM public.rotas r
    JOIN public.entregadores e ON e.id = r.entregador_id
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE u.empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'operacional'::public.app_role)
      )
  )
);
