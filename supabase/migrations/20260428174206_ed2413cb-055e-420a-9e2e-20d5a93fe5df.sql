CREATE OR REPLACE FUNCTION public.get_cliente_indicacao_resumo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_cliente record;
  v_creditos jsonb;
  v_ref_count integer;
  v_saldo numeric;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile.user_id IS NULL THEN
    RETURN jsonb_build_object('cliente_id', null, 'codigo_indicacao', 'CLIENTE', 'referral_count', 0, 'wallet_balance', 0, 'transactions', '[]'::jsonb);
  END IF;

  SELECT c.* INTO v_cliente
  FROM public.clientes c
  WHERE c.empresa_id = v_profile.empresa_id
    AND (
      (c.email IS NOT NULL AND v_profile.email IS NOT NULL AND lower(c.email) = lower(v_profile.email))
      OR (c.telefone IS NOT NULL AND v_profile.phone IS NOT NULL AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(v_profile.phone, '\D', '', 'g'))
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_cliente.id IS NULL THEN
    RETURN jsonb_build_object('cliente_id', null, 'codigo_indicacao', 'CLIENTE', 'referral_count', 0, 'wallet_balance', 0, 'transactions', '[]'::jsonb);
  END IF;

  SELECT COUNT(*)::integer INTO v_ref_count
  FROM public.cliente_indicacoes
  WHERE indicador_cliente_id = v_cliente.id
    AND status = 'convertida';

  SELECT COALESCE(SUM(CASE WHEN natureza = 'credito' AND status = 'disponivel' THEN valor WHEN natureza = 'debito' THEN -valor ELSE 0 END), 0)
  INTO v_saldo
  FROM public.cliente_creditos
  WHERE cliente_id = v_cliente.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cc.id,
    'type', CASE WHEN cc.natureza = 'debito' THEN 'debit' ELSE 'credit' END,
    'amount', cc.valor,
    'description', cc.descricao,
    'date', cc.created_at,
    'status', cc.status
  ) ORDER BY cc.created_at DESC), '[]'::jsonb)
  INTO v_creditos
  FROM public.cliente_creditos cc
  WHERE cc.cliente_id = v_cliente.id;

  RETURN jsonb_build_object(
    'cliente_id', v_cliente.id,
    'codigo_indicacao', COALESCE(v_cliente.codigo_indicacao, 'CLIENTE'),
    'referral_count', COALESCE(v_ref_count, 0),
    'wallet_balance', COALESCE(v_saldo, 0),
    'transactions', v_creditos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_cliente_indicacao_resumo() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_cliente_indicacao_resumo() TO authenticated;