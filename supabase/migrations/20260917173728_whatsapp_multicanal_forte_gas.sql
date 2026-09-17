-- Identifica o canal de origem em toda a trilha da conversa. Mantemos a
-- integração legada intacta para que a Z-API continue funcionando durante a
-- ativação gradual do número oficial.
ALTER TABLE public.ai_conversas
  ADD COLUMN IF NOT EXISTS whatsapp_canal text,
  ADD COLUMN IF NOT EXISTS whatsapp_numero_origem text;

ALTER TABLE public.ai_mensagens
  ADD COLUMN IF NOT EXISTS whatsapp_canal text;

ALTER TABLE public.whatsapp_eventos
  ADD COLUMN IF NOT EXISTS whatsapp_canal text;

ALTER TABLE public.ai_conversas
  DROP CONSTRAINT IF EXISTS ai_conversas_whatsapp_canal_check;
ALTER TABLE public.ai_conversas
  ADD CONSTRAINT ai_conversas_whatsapp_canal_check
  CHECK (whatsapp_canal IS NULL OR whatsapp_canal IN ('oficial_forte_gas', 'zapi_forte_gas'));

ALTER TABLE public.ai_mensagens
  DROP CONSTRAINT IF EXISTS ai_mensagens_whatsapp_canal_check;
ALTER TABLE public.ai_mensagens
  ADD CONSTRAINT ai_mensagens_whatsapp_canal_check
  CHECK (whatsapp_canal IS NULL OR whatsapp_canal IN ('oficial_forte_gas', 'zapi_forte_gas'));

ALTER TABLE public.whatsapp_eventos
  DROP CONSTRAINT IF EXISTS whatsapp_eventos_whatsapp_canal_check;
ALTER TABLE public.whatsapp_eventos
  ADD CONSTRAINT whatsapp_eventos_whatsapp_canal_check
  CHECK (whatsapp_canal IS NULL OR whatsapp_canal IN ('oficial_forte_gas', 'zapi_forte_gas'));

-- Conversas históricas da Forte Gás vieram da Z-API. O backfill é restrito à
-- unidade conhecida para não classificar dados de outras empresas.
UPDATE public.ai_conversas
SET whatsapp_canal = 'zapi_forte_gas',
    whatsapp_numero_origem = '5543988709696'
WHERE unidade_id = '3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05'
  AND whatsapp_canal IS NULL;

UPDATE public.ai_mensagens m
SET whatsapp_canal = COALESCE(c.whatsapp_canal, 'zapi_forte_gas')
FROM public.ai_conversas c
WHERE c.id = m.conversa_id
  AND c.unidade_id = '3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05'
  AND m.whatsapp_canal IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversas_whatsapp_canal
  ON public.ai_conversas (empresa_id, unidade_id, whatsapp_canal, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_mensagens_whatsapp_canal
  ON public.ai_mensagens (conversa_id, whatsapp_canal, created_at DESC);

-- O ID externo só precisa ser único dentro do canal/provedor. Isso evita que
-- duas plataformas diferentes bloqueiem uma à outra por coincidência de ID.
DROP INDEX IF EXISTS public.idx_ai_mensagens_wa_message_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_mensagens_canal_wa_message_id
  ON public.ai_mensagens (COALESCE(whatsapp_canal, 'legado'), wa_message_id)
  WHERE wa_message_id IS NOT NULL;
