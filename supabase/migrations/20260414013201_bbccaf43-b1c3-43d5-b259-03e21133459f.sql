
-- Function for base operators to mark entregador messages as read
CREATE OR REPLACE FUNCTION public.marcar_chat_lido_base(
  _remetente_id uuid,
  _destinatario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller belongs to the empresa that owns the unidade (destinatario)
  IF NOT EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = _destinatario_id
    AND u.empresa_id = public.get_user_empresa_id()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.chat_mensagens
  SET lida = true
  WHERE remetente_id = _remetente_id
    AND destinatario_id = _destinatario_id
    AND destinatario_tipo = 'base'
    AND remetente_tipo = 'entregador'
    AND lida = false;
END;
$$;

-- Function for entregadores to mark messages as read
CREATE OR REPLACE FUNCTION public.marcar_chat_lido_entregador(
  _entregador_id uuid,
  _remetente_id uuid,
  _remetente_tipo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller owns this entregador
  IF NOT EXISTS (
    SELECT 1 FROM public.entregadores
    WHERE id = _entregador_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.chat_mensagens
  SET lida = true
  WHERE destinatario_id = _entregador_id
    AND destinatario_tipo = 'entregador'
    AND remetente_tipo = _remetente_tipo
    AND lida = false
    AND (
      _remetente_tipo = 'base' 
      OR remetente_id = _remetente_id
    );
END;
$$;

-- Function to mark a single message as read (for realtime)
CREATE OR REPLACE FUNCTION public.marcar_msg_lida(
  _msg_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg RECORD;
BEGIN
  SELECT * INTO v_msg FROM public.chat_mensagens WHERE id = _msg_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Check: caller is the entregador recipient, or caller belongs to the base empresa
  IF v_msg.destinatario_tipo = 'entregador' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.entregadores WHERE id = v_msg.destinatario_id AND user_id = auth.uid()
    ) THEN RETURN; END IF;
  ELSIF v_msg.destinatario_tipo = 'base' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = v_msg.destinatario_id
      AND u.empresa_id = public.get_user_empresa_id()
    ) THEN RETURN; END IF;
  ELSE
    RETURN;
  END IF;

  UPDATE public.chat_mensagens SET lida = true WHERE id = _msg_id AND lida = false;
END;
$$;
