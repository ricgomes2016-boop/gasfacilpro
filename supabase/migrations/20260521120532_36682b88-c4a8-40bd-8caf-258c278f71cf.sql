
-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.bia_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.ai_conversas(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  unidade_id uuid,
  empresa_id uuid,
  motivo text NOT NULL DEFAULT 'preco_sem_pedido',
  desconto_oferecido numeric NOT NULL DEFAULT 5,
  agendado_para timestamptz NOT NULL,
  enviado_em timestamptz,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','cancelado','convertido')),
  tentativas int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bia_followups_conversa_pendente_uq
  ON public.bia_followups(conversa_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS bia_followups_due_idx
  ON public.bia_followups(agendado_para) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS bia_followups_empresa_idx
  ON public.bia_followups(empresa_id);

ALTER TABLE public.bia_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_gestores_view_followups"
  ON public.bia_followups FOR SELECT
  USING (
    public.has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gestor'::app_role))
      AND empresa_id = public.get_user_empresa_id()
    )
  );

CREATE TRIGGER trg_bia_followups_updated
  BEFORE UPDATE ON public.bia_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Função: agendar/cancelar follow-up a partir de novas mensagens
CREATE OR REPLACE FUNCTION public.fn_bia_followup_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_last_user TEXT;
  v_price_intent BOOLEAN;
  v_recent_sent INT;
BEGIN
  -- ignorar mensagens internas
  IF NEW.role NOT IN ('user','assistant') THEN
    RETURN NEW;
  END IF;

  SELECT id, telefone, unidade_id, empresa_id
    INTO v_conv
  FROM public.ai_conversas
  WHERE id = NEW.conversa_id;

  IF v_conv.telefone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cliente respondeu: cancela follow-up pendente
  IF NEW.role = 'user' THEN
    UPDATE public.bia_followups
       SET status = 'cancelado', updated_at = now()
     WHERE conversa_id = NEW.conversa_id AND status = 'pendente';
    RETURN NEW;
  END IF;

  -- assistant: se confirmou pedido, marca convertido
  IF NEW.content ILIKE '%[PEDIDO_CONFIRMADO]%' THEN
    UPDATE public.bia_followups
       SET status = 'convertido', updated_at = now()
     WHERE conversa_id = NEW.conversa_id AND status IN ('pendente','enviado');
    RETURN NEW;
  END IF;

  -- evita reagendar se já enviamos follow-up nas últimas 24h
  SELECT COUNT(*) INTO v_recent_sent
  FROM public.bia_followups
  WHERE conversa_id = NEW.conversa_id
    AND status = 'enviado'
    AND enviado_em > now() - interval '24 hours';
  IF v_recent_sent > 0 THEN
    RETURN NEW;
  END IF;

  -- pega última mensagem do cliente nos últimos 10 min
  SELECT content INTO v_last_user
  FROM public.ai_mensagens
  WHERE conversa_id = NEW.conversa_id
    AND role = 'user'
    AND created_at > now() - interval '10 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_user IS NULL THEN
    RETURN NEW;
  END IF;

  v_price_intent := unaccent(lower(v_last_user)) ~ '(preco|valor|quanto|quanta|custa|ta quanto|tá quanto|qual o valor|qto)';
  IF NOT v_price_intent THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bia_followups (conversa_id, telefone, unidade_id, empresa_id, motivo, desconto_oferecido, agendado_para)
  VALUES (NEW.conversa_id, v_conv.telefone, v_conv.unidade_id, v_conv.empresa_id, 'preco_sem_pedido', 5, now() + interval '5 minutes')
  ON CONFLICT (conversa_id) WHERE status = 'pendente'
  DO UPDATE SET agendado_para = EXCLUDED.agendado_para, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bia_followup_from_message ON public.ai_mensagens;
CREATE TRIGGER trg_bia_followup_from_message
  AFTER INSERT ON public.ai_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.fn_bia_followup_from_message();
