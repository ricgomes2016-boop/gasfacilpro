CREATE OR REPLACE FUNCTION public.buscar_clientes_paginado(_empresa_id uuid, _unidade_id uuid DEFAULT NULL::uuid, _termo text DEFAULT NULL::text, _apenas_ativos boolean DEFAULT true, _limite integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, codigo_cliente integer, nome text, telefone text, cpf text, email text, endereco text, numero text, bairro text, cidade text, cep text, tipo text, latitude numeric, longitude numeric, ativo boolean, bloqueio_credito boolean, saldo_devedor numeric, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_termo text;
  v_digits text;
BEGIN
  v_termo := NULLIF(TRIM(_termo), '');
  v_digits := CASE WHEN v_termo IS NOT NULL THEN regexp_replace(v_termo, '\D', '', 'g') ELSE '' END;

  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM public.clientes c
    WHERE c.empresa_id = _empresa_id
      AND (NOT _apenas_ativos OR c.ativo = true)
      AND (
        _unidade_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.cliente_unidades cu
          WHERE cu.cliente_id = c.id AND cu.unidade_id = _unidade_id
        )
      )
      AND (
        v_termo IS NULL
        OR c.nome ILIKE '%' || v_termo || '%'
        OR c.telefone ILIKE '%' || v_termo || '%'
        OR c.cpf = v_termo
        OR c.codigo_cliente::text = v_termo
        OR (length(v_termo) >= 3 AND c.endereco IS NOT NULL AND c.endereco ILIKE '%' || v_termo || '%')
        OR (length(v_termo) >= 3 AND c.bairro IS NOT NULL AND c.bairro ILIKE '%' || v_termo || '%')
        OR (v_digits <> '' AND c.numero IS NOT NULL AND regexp_replace(c.numero, '\D', '', 'g') = v_digits)
      )
  ),
  counted AS (SELECT COUNT(*) AS total FROM base)
  SELECT
    b.id, b.codigo_cliente, b.nome, b.telefone, b.cpf, b.email,
    b.endereco, b.numero, b.bairro, b.cidade, b.cep,
    b.tipo,
    b.latitude::numeric,
    b.longitude::numeric,
    b.ativo, b.bloqueio_credito, b.saldo_devedor, b.created_at,
    counted.total
  FROM base b, counted
  ORDER BY b.nome ASC
  LIMIT _limite OFFSET _offset;
END;
$function$;