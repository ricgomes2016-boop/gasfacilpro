-- Índices trigram para acelerar ILIKE em endereco e bairro
CREATE INDEX IF NOT EXISTS idx_clientes_endereco_trgm ON public.clientes USING gin (endereco gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_bairro_trgm ON public.clientes USING gin (bairro gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_nome_trgm ON public.clientes USING gin (nome gin_trgm_ops);

-- Nova RPC: autocomplete_clientes_v2 com busca por endereço + número combinado
CREATE OR REPLACE FUNCTION public.autocomplete_clientes_v2(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL,
  _termo text DEFAULT NULL,
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
BEGIN
  v_termo := NULLIF(TRIM(_termo), '');
  IF v_termo IS NULL THEN
    RETURN;
  END IF;

  v_termo_unaccent := unaccent(lower(v_termo));
  v_digits := regexp_replace(v_termo, '\D', '', 'g');

  -- Tenta separar parte textual de parte numérica (ex: "Rua Brasil 340")
  v_num_part := NULLIF(regexp_replace(v_termo, '[^0-9]', '', 'g'), '');
  v_text_part := NULLIF(TRIM(regexp_replace(v_termo, '[0-9,]+', ' ', 'g')), '');

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
        -- termo simples
        unaccent(lower(c.nome)) ILIKE '%' || v_termo_unaccent || '%'
        OR (c.telefone IS NOT NULL AND v_digits <> '' AND regexp_replace(c.telefone, '\D', '', 'g') ILIKE '%' || v_digits || '%')
        OR (c.endereco IS NOT NULL AND unaccent(lower(c.endereco)) ILIKE '%' || v_termo_unaccent || '%')
        OR (c.bairro IS NOT NULL AND unaccent(lower(c.bairro)) ILIKE '%' || v_termo_unaccent || '%')
        OR (c.cidade IS NOT NULL AND unaccent(lower(c.cidade)) ILIKE '%' || v_termo_unaccent || '%')
        -- termo combinado: rua + número
        OR (
          v_text_part IS NOT NULL AND v_num_part IS NOT NULL
          AND c.endereco IS NOT NULL
          AND unaccent(lower(c.endereco)) ILIKE '%' || unaccent(lower(v_text_part)) || '%'
          AND regexp_replace(COALESCE(c.numero,''), '\D', '', 'g') = v_num_part
        )
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
            AND b.endereco IS NOT NULL
            AND unaccent(lower(b.endereco)) ILIKE '%' || unaccent(lower(v_text_part)) || '%'
            AND regexp_replace(COALESCE(b.numero,''), '\D', '', 'g') = v_num_part THEN 7.0 ELSE 0 END
        + similarity(unaccent(lower(b.nome)), v_termo_unaccent) * 3.0
        + CASE WHEN b.endereco IS NOT NULL THEN similarity(unaccent(lower(b.endereco)), v_termo_unaccent) * 2.0 ELSE 0 END
      )::real AS score
    FROM base b
  )
  SELECT s.id, s.nome, s.telefone, s.endereco, s.numero, s.bairro, s.cep, s.cidade
  FROM scored s
  ORDER BY s.score DESC, s.nome ASC
  LIMIT _limite;
END;
$function$;

-- Atualiza buscar_clientes_paginado para incluir busca por endereço, bairro e número
CREATE OR REPLACE FUNCTION public.buscar_clientes_paginado(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL::uuid,
  _termo text DEFAULT NULL::text,
  _apenas_ativos boolean DEFAULT true,
  _limite integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, codigo_cliente integer, nome text, telefone text, cpf text, email text,
  endereco text, numero text, bairro text, cidade text,
  ativo boolean, bloqueio_credito boolean, saldo_devedor numeric,
  created_at timestamp with time zone, total_count bigint
)
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
    b.endereco, b.numero, b.bairro, b.cidade,
    b.ativo, b.bloqueio_credito, b.saldo_devedor, b.created_at,
    counted.total
  FROM base b, counted
  ORDER BY b.nome ASC
  LIMIT _limite OFFSET _offset;
END;
$function$;