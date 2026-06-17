-- Repair schema drift for WhatsApp inbox/BIA runtime.
-- Some environments had migrations marked as applied while these columns were
-- absent, causing the webhook or inbox queries to fail after receiving messages.

ALTER TABLE public.ai_conversas
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS pedido_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversas_status_check') THEN
    ALTER TABLE public.ai_conversas
      ADD CONSTRAINT ai_conversas_status_check
      CHECK (status IN ('active','closed','archived','transferred'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_conversas_telefone ON public.ai_conversas(telefone);
CREATE INDEX IF NOT EXISTS idx_ai_conversas_deleted_empresa_updated
  ON public.ai_conversas(empresa_id, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conversas_status ON public.ai_conversas(status);

ALTER TABLE public.ai_mensagens
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_mensagens_status_check') THEN
    ALTER TABLE public.ai_mensagens
      ADD CONSTRAINT ai_mensagens_status_check
      CHECK (status IS NULL OR status IN ('pending','sent','delivered','read','failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_mensagens_wa_message_id
  ON public.ai_mensagens(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS regras_bia jsonb DEFAULT '{
    "bia_ativa": true,
    "horario_abertura": "08:00",
    "horario_fechamento": "18:00",
    "horario_domingo_fechamento": "14:00",
    "domingo_ativo": true,
    "agua_entrega_domingo": true,
    "categorias_permitidas": ["gas", "agua", "vasilhame"],
    "mensagem_fora_horario": "Estamos fechados agora, mas posso agendar seu pedido!",
    "desconto_etapa1": 3,
    "desconto_etapa2": 5,
    "preco_minimo_p13": null,
    "preco_minimo_p20": null
  }'::jsonb;

ALTER TABLE public.integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS loja_foto_url text,
  ADD COLUMN IF NOT EXISTS loja_foto_atualizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS security_token text,
  ADD COLUMN IF NOT EXISTS preco_minimo_p20 numeric;

CREATE TABLE IF NOT EXISTS public.whatsapp_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  unidade_id uuid,
  conversa_id uuid REFERENCES public.ai_conversas(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.ai_mensagens(id) ON DELETE SET NULL,
  wa_message_id text,
  contato_wa_id text,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_conversa ON public.whatsapp_eventos(conversa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_wa_msg ON public.whatsapp_eventos(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_empresa ON public.whatsapp_eventos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_created ON public.whatsapp_eventos(created_at DESC);

ALTER TABLE public.whatsapp_eventos ENABLE ROW LEVEL SECURITY;
