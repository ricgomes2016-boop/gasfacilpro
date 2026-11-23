-- Corrige busca de clientes apos migracao de filial para matriz.
-- Mantem as assinaturas e a inteligencia das RPCs existentes, reforcando:
-- 1) isolamento por empresa;
-- 2) matriz busca em toda a empresa;
-- 3) filial tambem encontra clientes legados sem vinculo em cliente_unidades.

CREATE OR REPLACE FUNCTION public.autocomplete_clientes_v2(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL::uuid,
  _termo text DEFAULT NULL::text,
  _limite integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  nome text,
  telefone text,
  endereco text,
  numero text,
  bairro text,
  cep text,
  cidade text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_termo text;
  v_termo_unaccent text;
  v_digits text;
  v_text_part text;
  v_num_part text;
  v_unidade_is_matriz boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR _empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), _empresa_id)
  ) THEN
    RETURN;
  END IF;

  IF _unidade_id IS NOT NULL THEN
    SELECT COALESCE(u.tipo = 'matriz', false)
      INTO v_unidade_is_matriz
    FROM public.unidades u
    WHERE u.id = _unidade_id
      AND u.empresa_id = _empresa_id;
  END IF;

  v_termo := NULLIF(TRIM(_termo), '');
  IF v_termo IS NULL THEN
    RETURN;
  END IF;

  v_termo_unaccent := unaccent(lower(v_termo));
  v_digits := regexp_replace(v_termo, '\D', '', 'g');
  v_num_part := NULLIF(regexp_replace(v_termo, '[^0-9]', '', 'g'), '');
  v_text_part := NULLIF(TRIM(regexp_replace(v_termo, '[0-9,]+', ' ', 'g')), '');

  RETURN QUERY
  WITH ends AS (
    SELECT DISTINCT ON (ce.cliente_id)
      ce.cliente_id,
      ce.rua,
      ce.numero,
      ce.bairro,
      ce.cep,
      ce.cidade
    FROM public.cliente_enderecos ce
    ORDER BY ce.cliente_id, ce.principal DESC NULLS LAST, ce.updated_at DESC NULLS LAST
  ),
  ends_match AS (
    SELECT ce.cliente_id
    FROM public.cliente_enderecos ce
    WHERE
      (ce.rua IS NOT NULL AND unaccent(lower(ce.rua)) ILIKE '%' || v_termo_unaccent || '%')
      OR (ce.bairro IS NOT NULL AND unaccent(lower(ce.bairro)) ILIKE '%' || v_termo_unaccent || '%')
      OR (ce.cidade IS NOT NULL AND unaccent(lower(ce.cidade)) ILIKE '%' || v_termo_unaccent || '%')
      OR (ce.cep IS NOT NULL AND v_digits <> '' AND regexp_replace(ce.cep, '\D', '', 'g') ILIKE '%' || v_digits || '%')
      OR (
        v_text_part IS NOT NULL AND v_num_part IS NOT NULL
        AND ce.rua IS NOT NULL
        AND unaccent(lower(ce.rua)) ILIKE '%' || unaccent(lower(v_text_part)) || '%'
        AND regexp_replace(COALESCE(ce.numero,''), '\D', '', 'g') = v_num_part
      )
  ),
  base AS (
    SELECT
      c.*,
      e.rua AS e_rua,
      e.numero AS e_numero,
      e.bairro AS e_bairro,
      e.cep AS e_cep,
      e.cidade AS e_cidade
    FROM public.clientes c
    LEFT JOIN ends e ON e.cliente_id = c.id
    WHERE c.empresa_id = _empresa_id
      AND c.ativo = true
      AND (
        _unidade_id IS NULL
        OR v_unidade_is_matriz
        OR EXISTS (
          SELECT 1
          FROM public.cliente_unidades cu
          WHERE cu.cliente_id = c.id
            AND cu.unidade_id = _unidade_id
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.cliente_unidades cu_any
          WHERE cu_any.cliente_id = c.id
        )
      )
      AND (
        unaccent(lower(c.nome)) ILIKE '%' || v_termo_unaccent || '%'
        OR (c.telefone IS NOT NULL AND v_digits <> '' AND regexp_replace(c.telefone, '\D', '', 'g') ILIKE '%' || v_digits || '%')
        OR (c.endereco IS NOT NULL AND unaccent(lower(c.endereco)) ILIKE '%' || v_termo_unaccent || '%')
        OR (c.bairro IS NOT NULL AND unaccent(lower(c.bairro)) ILIKE '%' || v_termo_unaccent || '%')
        OR (c.cidade IS NOT NULL AND unaccent(lower(c.cidade)) ILIKE '%' || v_termo_unaccent || '%')
        OR (
          v_text_part IS NOT NULL AND v_num_part IS NOT NULL
          AND c.endereco IS NOT NULL
          AND unaccent(lower(c.endereco)) ILIKE '%' || unaccent(lower(v_text_part)) || '%'
          AND (
            regexp_replace(COALESCE(c.numero,''), '\D', '', 'g') = v_num_part
            OR unaccent(lower(c.endereco)) ~ ('(^|[^0-9])' || v_num_part || '([^0-9]|$)')
          )
        )
        OR c.id IN (SELECT cliente_id FROM ends_match)
      )
    LIMIT 200
  ),
  scored AS (
    SELECT
      b.*,
      (
        CASE WHEN unaccent(lower(b.nome)) ILIKE v_termo_unaccent || '%' THEN 10.0 ELSE 0 END
        + CASE WHEN v_digits <> '' AND b.telefone IS NOT NULL
            AND regexp_replace(b.telefone, '\D', '', 'g') ILIKE '%' || v_digits || '%' THEN 8.0 ELSE 0 END
        + CASE WHEN v_text_part IS NOT NULL AND v_num_part IS NOT NULL
            AND COALESCE(b.endereco, b.e_rua) IS NOT NULL
            AND unaccent(lower(COALESCE(b.endereco, b.e_rua))) ILIKE '%' || unaccent(lower(v_text_part)) || '%'
            AND (
              regexp_replace(COALESCE(b.numero, b.e_numero,''), '\D', '', 'g') = v_num_part
              OR (b.endereco IS NOT NULL AND unaccent(lower(b.endereco)) ~ ('(^|[^0-9])' || v_num_part || '([^0-9]|$)'))
            )
          THEN 7.0 ELSE 0 END
        + similarity(unaccent(lower(b.nome)), v_termo_unaccent) * 3.0
        + CASE WHEN b.endereco IS NOT NULL THEN similarity(unaccent(lower(b.endereco)), v_termo_unaccent) * 2.0 ELSE 0 END
        + CASE WHEN b.e_rua IS NOT NULL THEN similarity(unaccent(lower(b.e_rua)), v_termo_unaccent) * 2.0 ELSE 0 END
      )::real AS score
    FROM base b
  )
  SELECT
    s.id,
    s.nome,
    s.telefone,
    COALESCE(NULLIF(s.endereco, ''), s.e_rua) AS endereco,
    COALESCE(NULLIF(s.numero, ''), s.e_numero) AS numero,
    COALESCE(NULLIF(s.bairro, ''), s.e_bairro) AS bairro,
    COALESCE(NULLIF(s.cep, ''), s.e_cep) AS cep,
    COALESCE(NULLIF(s.cidade, ''), s.e_cidade) AS cidade
  FROM scored s
  ORDER BY s.score DESC, s.nome ASC
  LIMIT _limite;
END;
$function$;

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
  v_unidade_is_matriz boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR _empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), _empresa_id)
  ) THEN
    RETURN;
  END IF;

  IF _unidade_id IS NOT NULL THEN
    SELECT COALESCE(u.tipo = 'matriz', false)
      INTO v_unidade_is_matriz
    FROM public.unidades u
    WHERE u.id = _unidade_id
      AND u.empresa_id = _empresa_id;
  END IF;

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
        OR v_unidade_is_matriz
        OR EXISTS (
          SELECT 1
          FROM public.cliente_unidades cu
          WHERE cu.cliente_id = c.id
            AND cu.unidade_id = _unidade_id
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.cliente_unidades cu_any
          WHERE cu_any.cliente_id = c.id
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
