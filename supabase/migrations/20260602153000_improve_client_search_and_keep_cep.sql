CREATE OR REPLACE FUNCTION public.buscar_clientes_paginado(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL::uuid,
  _termo text DEFAULT NULL::text,
  _apenas_ativos boolean DEFAULT true,
  _limite integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  codigo_cliente integer,
  nome text,
  telefone text,
  cpf text,
  email text,
  endereco text,
  numero text,
  bairro text,
  cidade text,
  cep text,
  tipo text,
  latitude numeric,
  longitude numeric,
  ativo boolean,
  bloqueio_credito boolean,
  saldo_devedor numeric,
  created_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_termo text;
  v_termo_norm text;
  v_digits text;
  v_tokens text[];
BEGIN
  v_termo := NULLIF(TRIM(_termo), '');
  v_termo_norm := CASE
    WHEN v_termo IS NOT NULL THEN regexp_replace(unaccent(lower(v_termo)), '\s+', ' ', 'g')
    ELSE NULL
  END;
  v_digits := CASE WHEN v_termo IS NOT NULL THEN regexp_replace(v_termo, '\D', '', 'g') ELSE '' END;
  v_tokens := CASE
    WHEN v_termo_norm IS NOT NULL THEN regexp_split_to_array(v_termo_norm, '\s+')
    ELSE ARRAY[]::text[]
  END;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      c.*,
      regexp_replace(
        unaccent(lower(concat_ws(' ',
          c.nome,
          c.razao_social,
          c.nome_fantasia,
          c.telefone,
          c.cpf,
          c.codigo_cliente::text,
          c.endereco,
          c.numero,
          c.bairro,
          c.cidade,
          c.cep,
          c.tipo
        ))),
        '\s+',
        ' ',
        'g'
      ) AS searchable_text,
      regexp_replace(concat_ws(' ', c.telefone, c.cpf, c.codigo_cliente::text, c.numero, c.cep), '\D', '', 'g') AS searchable_digits
    FROM public.clientes c
    WHERE c.empresa_id = _empresa_id
      AND (NOT _apenas_ativos OR c.ativo = true)
      AND (
        _unidade_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.cliente_unidades cu
          WHERE cu.cliente_id = c.id
            AND cu.unidade_id = _unidade_id
        )
      )
  ),
  base AS (
    SELECT s.*
    FROM scoped s
    WHERE v_termo IS NULL
      OR s.searchable_text ILIKE '%' || v_termo_norm || '%'
      OR (v_digits <> '' AND s.searchable_digits ILIKE '%' || v_digits || '%')
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(v_tokens) token
        WHERE token <> ''
          AND s.searchable_text NOT ILIKE '%' || token || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total
    FROM base
  ),
  scored AS (
    SELECT
      b.*,
      (
        CASE WHEN v_termo IS NULL THEN 0 ELSE 0 END
        + CASE WHEN v_termo_norm IS NOT NULL AND unaccent(lower(b.nome)) = v_termo_norm THEN 40.0 ELSE 0 END
        + CASE WHEN v_termo_norm IS NOT NULL AND unaccent(lower(b.nome)) ILIKE v_termo_norm || '%' THEN 24.0 ELSE 0 END
        + CASE WHEN v_termo_norm IS NOT NULL AND b.searchable_text ILIKE '%' || v_termo_norm || '%' THEN 12.0 ELSE 0 END
        + CASE WHEN v_digits <> '' AND b.codigo_cliente::text = v_digits THEN 30.0 ELSE 0 END
        + CASE WHEN v_digits <> '' AND b.searchable_digits ILIKE '%' || v_digits || '%' THEN 10.0 ELSE 0 END
        + CASE WHEN v_termo_norm IS NOT NULL THEN similarity(unaccent(lower(b.nome)), v_termo_norm) * 8.0 ELSE 0 END
      )::numeric AS search_score
    FROM base b
  )
  SELECT
    s.id,
    s.codigo_cliente,
    s.nome,
    s.telefone,
    s.cpf,
    s.email,
    s.endereco,
    s.numero,
    s.bairro,
    s.cidade,
    s.cep,
    s.tipo,
    s.latitude::numeric,
    s.longitude::numeric,
    s.ativo,
    s.bloqueio_credito,
    s.saldo_devedor,
    s.created_at,
    counted.total
  FROM scored s, counted
  ORDER BY
    CASE WHEN v_termo IS NULL THEN NULL ELSE s.search_score END DESC NULLS LAST,
    s.nome ASC
  LIMIT _limite OFFSET _offset;
END;
$function$;
