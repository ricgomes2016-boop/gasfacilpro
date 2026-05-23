
-- =============================================================
-- FASE A: user_roles — bloquear escalação de privilégios
-- =============================================================
DROP POLICY IF EXISTS "tenant_isolation_user_roles" ON public.user_roles;

-- SELECT amplo (leitura) permanece, mas separado de escrita
CREATE POLICY "Same empresa can view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR user_id = auth.uid()
    OR user_in_same_empresa(user_id)
  );

-- Escrita: somente admin/super_admin. Já existe "Admins can manage all roles" (ALL),
-- mas sem WITH CHECK — vamos endurecê-la.
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- FASE B: ai_mensagens — adiciona empresa_id / unidade_id
-- =============================================================
ALTER TABLE public.ai_mensagens
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid;

-- Backfill via conversa
UPDATE public.ai_mensagens m
SET empresa_id = c.empresa_id,
    unidade_id = c.unidade_id
FROM public.ai_conversas c
WHERE m.conversa_id = c.id
  AND (m.empresa_id IS NULL OR m.unidade_id IS NULL);

-- Índices p/ Realtime e RLS
CREATE INDEX IF NOT EXISTS idx_ai_mensagens_empresa_created
  ON public.ai_mensagens (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_mensagens_unidade_created
  ON public.ai_mensagens (unidade_id, created_at DESC);

-- Trigger BEFORE INSERT/UPDATE: nunca confia no payload do cliente para tenant
CREATE OR REPLACE FUNCTION public.fn_ai_mensagens_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_uni uuid;
BEGIN
  SELECT empresa_id, unidade_id INTO v_emp, v_uni
  FROM public.ai_conversas WHERE id = NEW.conversa_id;
  NEW.empresa_id := v_emp;
  NEW.unidade_id := v_uni;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_mensagens_set_tenant ON public.ai_mensagens;
CREATE TRIGGER trg_ai_mensagens_set_tenant
  BEFORE INSERT OR UPDATE OF conversa_id ON public.ai_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.fn_ai_mensagens_set_tenant();

-- RLS endurecida: usa empresa_id diretamente
DROP POLICY IF EXISTS "tenant_isolation_ai_mensagens" ON public.ai_mensagens;
DROP POLICY IF EXISTS "Users can manage messages of their conversations" ON public.ai_mensagens;
DROP POLICY IF EXISTS "Operadores veem mensagens WhatsApp da plataforma" ON public.ai_mensagens;
DROP POLICY IF EXISTS "Operadores inserem mensagens WhatsApp da plataforma" ON public.ai_mensagens;

CREATE POLICY "ai_mensagens select tenant"
  ON public.ai_mensagens FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (empresa_id IS NOT NULL AND empresa_id = get_user_empresa_id())
    OR EXISTS (
      SELECT 1 FROM public.ai_conversas c
      WHERE c.id = ai_mensagens.conversa_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ai_mensagens insert tenant"
  ON public.ai_mensagens FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.ai_conversas c
      WHERE c.id = ai_mensagens.conversa_id
        AND (
          c.user_id = auth.uid()
          OR (c.empresa_id IS NOT NULL AND c.empresa_id = get_user_empresa_id())
        )
    )
  );

CREATE POLICY "ai_mensagens update tenant"
  ON public.ai_mensagens FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (empresa_id IS NOT NULL AND empresa_id = get_user_empresa_id())
  );

CREATE POLICY "ai_mensagens delete tenant"
  ON public.ai_mensagens FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      empresa_id IS NOT NULL
      AND empresa_id = get_user_empresa_id()
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
    )
  );

-- =============================================================
-- FASE C: ai_conversas — soft delete + filtro padrão
-- =============================================================
ALTER TABLE public.ai_conversas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_ai_conversas_empresa_updated
  ON public.ai_conversas (empresa_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================
-- FASE D: Realtime — habilita publicação filtrável por empresa
-- =============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_mensagens;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ai_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.ai_conversas REPLICA IDENTITY FULL;

-- =============================================================
-- FASE E: Auditoria nas tabelas sensíveis
-- =============================================================
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_integracoes_whatsapp ON public.integracoes_whatsapp;
CREATE TRIGGER audit_integracoes_whatsapp
  AFTER INSERT OR UPDATE OR DELETE ON public.integracoes_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ai_conversas ON public.ai_conversas;
CREATE TRIGGER audit_ai_conversas
  AFTER UPDATE OR DELETE ON public.ai_conversas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
