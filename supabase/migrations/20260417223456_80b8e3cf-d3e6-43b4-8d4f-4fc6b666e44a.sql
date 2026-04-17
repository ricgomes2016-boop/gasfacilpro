-- 1) Add codigo_cliente column
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo_cliente integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_empresa_codigo
  ON public.clientes(empresa_id, codigo_cliente)
  WHERE codigo_cliente IS NOT NULL;

-- 2) Backfill sequential codes per empresa
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY created_at, id) AS rn
  FROM public.clientes
  WHERE empresa_id IS NOT NULL AND codigo_cliente IS NULL
)
UPDATE public.clientes c
SET codigo_cliente = n.rn
FROM numbered n
WHERE c.id = n.id;

-- 3) Auto-assign trigger
CREATE OR REPLACE FUNCTION public.fn_assign_codigo_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  IF NEW.codigo_cliente IS NULL AND NEW.empresa_id IS NOT NULL THEN
    SELECT COALESCE(MAX(codigo_cliente), 0) + 1
      INTO v_next
      FROM public.clientes
      WHERE empresa_id = NEW.empresa_id;
    NEW.codigo_cliente := v_next;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_codigo_cliente ON public.clientes;
CREATE TRIGGER trg_assign_codigo_cliente
BEFORE INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.fn_assign_codigo_cliente();

-- 4) Fix phones with extra "55" prefix (13 digits starting with 55)
UPDATE public.clientes
SET telefone = SUBSTRING(telefone FROM 3)
WHERE telefone ~ '^55[0-9]{11}$';

-- 5) Drop and recreate RPC with new column
DROP FUNCTION IF EXISTS public.buscar_clientes_paginado(uuid, uuid, text, boolean, integer, integer);

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
        OR c.codigo_cliente::text = v_termo
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

-- 6) Delete clients without address
DELETE FROM public.cliente_unidades
WHERE cliente_id IN (
  SELECT id FROM public.clientes
  WHERE (endereco IS NULL OR TRIM(endereco) = '')
);

DELETE FROM public.clientes
WHERE (endereco IS NULL OR TRIM(endereco) = '');