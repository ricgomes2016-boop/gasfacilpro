-- Habilitar trigram para busca textual rápida (LIKE/ILIKE com índice)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Índices em clientes
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_ativo ON public.clientes (empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_created ON public.clientes (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_nome_trgm ON public.clientes USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone_trgm ON public.clientes USING gin (telefone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON public.clientes (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_bairro ON public.clientes (empresa_id, bairro);

-- Índices em cliente_unidades (joins por filial)
CREATE INDEX IF NOT EXISTS idx_cliente_unidades_unidade ON public.cliente_unidades (unidade_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_unidades_cliente ON public.cliente_unidades (cliente_id);

-- Índices em pedidos para joins com clientes
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON public.pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente ON public.contas_receber (cliente_id);

-- RPC paginada com busca textual otimizada
CREATE OR REPLACE FUNCTION public.buscar_clientes_paginado(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL,
  _termo text DEFAULT NULL,
  _apenas_ativos boolean DEFAULT true,
  _limite integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  cpf text,
  email text,
  endereco text,
  numero text,
  bairro text,
  cidade text,
  ativo boolean,
  bloqueio_credito boolean,
  saldo_devedor numeric,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_termo text;
BEGIN
  v_termo := NULLIF(TRIM(_termo), '');

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
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM base
  )
  SELECT
    b.id, b.nome, b.telefone, b.cpf, b.email,
    b.endereco, b.numero, b.bairro, b.cidade,
    b.ativo, b.bloqueio_credito, b.saldo_devedor, b.created_at,
    counted.total
  FROM base b, counted
  ORDER BY b.nome ASC
  LIMIT _limite OFFSET _offset;
END;
$$;

-- RPC mais leve para autocomplete em Nova Venda (só o essencial)
CREATE OR REPLACE FUNCTION public.autocomplete_clientes(
  _empresa_id uuid,
  _unidade_id uuid DEFAULT NULL,
  _termo text DEFAULT NULL,
  _limite integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  endereco text,
  numero text,
  bairro text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_termo text;
BEGIN
  v_termo := NULLIF(TRIM(_termo), '');

  RETURN QUERY
  SELECT c.id, c.nome, c.telefone, c.endereco, c.numero, c.bairro
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
      v_termo IS NULL
      OR c.nome ILIKE v_termo || '%'  -- prefixo é mais rápido
      OR c.nome ILIKE '%' || v_termo || '%'
      OR c.telefone ILIKE '%' || v_termo || '%'
    )
  ORDER BY
    CASE WHEN v_termo IS NOT NULL AND c.nome ILIKE v_termo || '%' THEN 0 ELSE 1 END,
    c.nome ASC
  LIMIT _limite;
END;
$$;