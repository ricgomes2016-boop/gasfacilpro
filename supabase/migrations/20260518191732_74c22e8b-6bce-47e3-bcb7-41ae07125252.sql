-- 1) ai_conversas: gestão de atendimento
ALTER TABLE public.ai_conversas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS pedido_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversas_status_check') THEN
    ALTER TABLE public.ai_conversas
      ADD CONSTRAINT ai_conversas_status_check
      CHECK (status IN ('active','closed','archived','transferred'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_conversas_status ON public.ai_conversas(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversas_assigned ON public.ai_conversas(assigned_to_user_id);

-- 2) ai_mensagens: status real WhatsApp
ALTER TABLE public.ai_mensagens
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_mensagens' AND column_name='direction') THEN
    ALTER TABLE public.ai_mensagens
      ADD COLUMN direction text GENERATED ALWAYS AS (
        CASE WHEN role = 'user' THEN 'inbound' ELSE 'outbound' END
      ) STORED;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_mensagens_status_check') THEN
    ALTER TABLE public.ai_mensagens
      ADD CONSTRAINT ai_mensagens_status_check
      CHECK (status IS NULL OR status IN ('pending','sent','delivered','read','failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_mensagens_wa_message_id
  ON public.ai_mensagens(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_mensagens_direction_status
  ON public.ai_mensagens(direction, status);

-- 3) whatsapp_eventos: auditoria
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

DROP POLICY IF EXISTS "Operadores veem eventos WhatsApp da empresa" ON public.whatsapp_eventos;
CREATE POLICY "Operadores veem eventos WhatsApp da empresa"
  ON public.whatsapp_eventos FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'operacional'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Service role insere eventos WhatsApp" ON public.whatsapp_eventos;
CREATE POLICY "Service role insere eventos WhatsApp"
  ON public.whatsapp_eventos FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
  );