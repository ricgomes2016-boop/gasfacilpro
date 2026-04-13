
CREATE OR REPLACE FUNCTION public.notify_base_chat(
  _unidade_id uuid,
  _entregador_nome text,
  _mensagem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.unidades WHERE id = _unidade_id;
  
  IF v_empresa_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
  SELECT ur.user_id, 'chat', 
    '💬 Mensagem de ' || _entregador_nome,
    LEFT(_mensagem, 100),
    '/dashboard'
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'gestor')
    AND p.empresa_id = v_empresa_id;
END;
$$;
