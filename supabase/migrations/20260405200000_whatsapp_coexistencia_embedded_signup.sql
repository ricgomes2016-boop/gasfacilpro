-- ============================================================
-- Migração: Suporte à Coexistência (QR Code) e Embedded Signup
-- Meta WhatsApp Cloud API — GasFacilPro
-- Data: 2026-04-05
-- ============================================================

BEGIN;

-- 1. Adicionar colunas para Embedded Signup (fluxo de autorização OAuth da Meta)
ALTER TABLE public.integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS meta_app_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_embedded_signup_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_token_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_coexistencia_ativa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_numero_display TEXT,
  ADD COLUMN IF NOT EXISTS meta_qualidade_numero TEXT DEFAULT 'GREEN',
  ADD COLUMN IF NOT EXISTS meta_limite_mensagens TEXT DEFAULT 'TIER_1K',
  ADD COLUMN IF NOT EXISTS meta_webhook_configurado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_app_review_aprovado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nome_bot TEXT;

-- 2. Criar tabela para armazenar o histórico de conexões QR Code
CREATE TABLE IF NOT EXISTS public.whatsapp_conexoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE NOT NULL,
  integracao_id UUID REFERENCES public.integracoes_whatsapp(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL, -- 'qr_gerado', 'conectado', 'desconectado', 'erro', 'embedded_signup'
  detalhes JSONB DEFAULT '{}',
  ip_origem TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para whatsapp_conexoes_log
ALTER TABLE public.whatsapp_conexoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de conexão da sua empresa"
ON public.whatsapp_conexoes_log FOR SELECT TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "Service role pode inserir logs"
ON public.whatsapp_conexoes_log FOR INSERT TO service_role
WITH CHECK (true);

-- 3. Criar tabela para armazenar configurações do App Meta (por empresa SaaS)
CREATE TABLE IF NOT EXISTS public.meta_app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  app_secret TEXT,
  verify_token TEXT NOT NULL DEFAULT 'gasfacil_meta_verify',
  webhook_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id)
);

-- RLS para meta_app_config
ALTER TABLE public.meta_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar config Meta da sua empresa"
ON public.meta_app_config FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id
    AND e.id = (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid() LIMIT 1
    )
  )
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id
    AND e.id = (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid() LIMIT 1
    )
  )
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- 4. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_integracoes_whatsapp_provedor_ativo
  ON public.integracoes_whatsapp(provedor, ativo);

CREATE INDEX IF NOT EXISTS idx_integracoes_whatsapp_meta_phone
  ON public.integracoes_whatsapp(meta_phone_number_id)
  WHERE meta_phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conexoes_log_unidade
  ON public.whatsapp_conexoes_log(unidade_id, created_at DESC);

-- 5. Atualizar a coluna provedor para aceitar o valor 'meta_coex' (coexistência)
-- O provedor 'meta' continua funcionando para Cloud API padrão
-- O provedor 'meta_coex' indica que o número usa Coexistência (QR Code + Cloud API)
-- Não precisamos alterar o CHECK constraint pois o campo é TEXT sem restrição

-- 6. Função para registrar evento de conexão
CREATE OR REPLACE FUNCTION public.registrar_evento_whatsapp(
  p_unidade_id UUID,
  p_integracao_id UUID,
  p_tipo_evento TEXT,
  p_detalhes JSONB DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.whatsapp_conexoes_log (
    unidade_id, integracao_id, tipo_evento, detalhes
  ) VALUES (
    p_unidade_id, p_integracao_id, p_tipo_evento, p_detalhes
  );
END;
$$;

-- 7. Função para limpar QR codes expirados (chamada periodicamente)
CREATE OR REPLACE FUNCTION public.limpar_qrcodes_expirados()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.integracoes_whatsapp
  SET
    qr_code_base64 = NULL,
    qr_code_expira_em = NULL,
    status_conexao = 'desconectado'
  WHERE
    qr_code_expira_em IS NOT NULL
    AND qr_code_expira_em < now()
    AND status_conexao = 'aguardando';
END;
$$;

COMMIT;
