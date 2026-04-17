CREATE OR REPLACE FUNCTION public.buscar_clientes_para_ia(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL,
  _nome text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _endereco_rua text DEFAULT NULL,
  _numero text DEFAULT NULL,
  _bairro text DEFAULT NULL,
  _limite integer DEFAULT 15
)
RETURNS TABLE(
  id uuid,
  codigo_cliente integer,
  nome text,
  telefone text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  cidade text,
  score real
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_tel text;
  v_rua text;
  v_num text;
  v_bairro text;
BEGIN
  v_nome := NULLIF(TRIM(_nome), '');
  v_tel := NULLIF(regexp_replace(COALESCE(_telefone, ''), '\D', '', 'g'), '');
  v_rua := NULLIF(TRIM(_endereco_rua), '');
  v_num := NULLIF(TRIM(_numero), '');
  v_bairro := NULLIF(TRIM(_bairro), '');

  -- Se nada foi informado, retorna vazio
  IF v_nome IS NULL AND v_tel IS NULL AND v_rua IS NULL AND v_bairro IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM public.clientes c
    WHERE c.empresa_id = _empresa_id
      AND c.ativo = true
      AND (
        _unidade_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.cliente_unidades cu
          WHERE cu.cliente_id = c.id AND cu.unidade_id = _unidade_id
        )
      )
      AND (
        -- Pré-filtro: precisa bater em ALGO para entrar no ranking
        (v_nome IS NOT NULL AND unaccent(c.nome) ILIKE '%' || unaccent(v_nome) || '%')
        OR (v_tel IS NOT NULL AND regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') ILIKE '%' || v_tel || '%')
        OR (v_rua IS NOT NULL AND c.endereco IS NOT NULL AND unaccent(c.endereco) ILIKE '%' || unaccent(v_rua) || '%')
        OR (v_bairro IS NOT NULL AND c.bairro IS NOT NULL AND unaccent(c.bairro) ILIKE '%' || unaccent(v_bairro) || '%')
      )
    LIMIT 200
  ),
  scored AS (
    SELECT
      b.*,
      (
        -- Score nome (peso 3)
        CASE WHEN v_nome IS NOT NULL
          THEN similarity(unaccent(lower(b.nome)), unaccent(lower(v_nome))) * 3.0
          ELSE 0 END
        -- Telefone match exato/parcial (peso 5 - mais confiável)
        + CASE WHEN v_tel IS NOT NULL AND b.telefone IS NOT NULL
          AND regexp_replace(b.telefone, '\D', '', 'g') ILIKE '%' || v_tel || '%'
          THEN 5.0 ELSE 0 END
        -- Score rua (peso 2.5)
        + CASE WHEN v_rua IS NOT NULL AND b.endereco IS NOT NULL
          THEN similarity(unaccent(lower(b.endereco)), unaccent(lower(v_rua))) * 2.5
          ELSE 0 END
        -- Score bairro (peso 1.5)
        + CASE WHEN v_bairro IS NOT NULL AND b.bairro IS NOT NULL
          THEN similarity(unaccent(lower(b.bairro)), unaccent(lower(v_bairro))) * 1.5
          ELSE 0 END
        -- Número exato (peso 2 - desempate forte)
        + CASE WHEN v_num IS NOT NULL AND b.numero IS NOT NULL
          AND regexp_replace(b.numero, '\D', '', 'g') = regexp_replace(v_num, '\D', '', 'g')
          THEN 2.0 ELSE 0 END
      )::real AS calc_score
    FROM base b
  )
  SELECT
    s.id, s.codigo_cliente, s.nome, s.telefone,
    s.endereco, s.numero, NULL::text AS complemento,
    s.bairro, s.cep, s.cidade, s.calc_score
  FROM scored s
  WHERE s.calc_score > 0
  ORDER BY s.calc_score DESC, s.nome ASC
  LIMIT _limite;
END;
$function$;