-- Numeração de pedidos independente por unidade/loja.
-- Preserva a sequência da unidade principal (matriz mais antiga) de cada empresa
-- e renumera as demais unidades a partir de 1, pela ordem cronológica.

CREATE TABLE IF NOT EXISTS public.pedido_sequencias_unidade (
  unidade_id uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  ultimo_numero integer NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_sequencias_unidade ENABLE ROW LEVEL SECURITY;

-- Tabela interna usada somente pelas funções SECURITY DEFINER.
REVOKE ALL ON public.pedido_sequencias_unidade FROM anon, authenticated;

-- Identifica a unidade principal de cada empresa: prefere a matriz e,
-- caso não exista, preserva a unidade mais antiga. A sequência existente
-- dessa unidade é mantida; as filiais passam a possuir sequência própria.
WITH unidades_principais AS (
  SELECT DISTINCT ON (COALESCE(u.empresa_id, u.id))
    u.id AS unidade_id
  FROM public.unidades u
  ORDER BY COALESCE(u.empresa_id, u.id),
           CASE WHEN u.tipo = 'matriz' THEN 0 ELSE 1 END,
           u.created_at ASC,
           u.id ASC
),
renumerados AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.unidade_id
      ORDER BY p.created_at ASC, p.id ASC
    )::integer AS novo_numero
  FROM public.pedidos p
  WHERE p.unidade_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM unidades_principais principal
      WHERE principal.unidade_id = p.unidade_id
    )
)
UPDATE public.pedidos p
SET numero_sequencial = r.novo_numero
FROM renumerados r
WHERE p.id = r.id;

-- Inicializa o contador usando os números já válidos após a renumeração.
INSERT INTO public.pedido_sequencias_unidade (unidade_id, ultimo_numero, updated_at)
SELECT p.unidade_id, COALESCE(MAX(p.numero_sequencial), 0), now()
FROM public.pedidos p
WHERE p.unidade_id IS NOT NULL
GROUP BY p.unidade_id
ON CONFLICT (unidade_id) DO UPDATE
SET ultimo_numero = EXCLUDED.ultimo_numero,
    updated_at = now();

-- Atribui o próximo número de forma atômica por unidade.
-- Isso evita que duas vendas simultâneas da mesma loja recebam o mesmo número.
CREATE OR REPLACE FUNCTION public.fn_assign_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
BEGIN
  -- Mantém compatibilidade para registros legados sem unidade.
  IF NEW.unidade_id IS NULL THEN
    IF NEW.numero_sequencial IS NULL THEN
      SELECT COALESCE(MAX(p.numero_sequencial), 0) + 1
        INTO NEW.numero_sequencial
        FROM public.pedidos p
       WHERE p.unidade_id IS NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.numero_sequencial IS NULL THEN
    INSERT INTO public.pedido_sequencias_unidade (unidade_id, ultimo_numero, updated_at)
    VALUES (NEW.unidade_id, 1, now())
    ON CONFLICT (unidade_id) DO UPDATE
      SET ultimo_numero = public.pedido_sequencias_unidade.ultimo_numero + 1,
          updated_at = now()
    RETURNING ultimo_numero INTO v_next;

    NEW.numero_sequencial := v_next;
  ELSE
    -- Importações com número informado não podem deixar o contador para trás.
    INSERT INTO public.pedido_sequencias_unidade (unidade_id, ultimo_numero, updated_at)
    VALUES (NEW.unidade_id, NEW.numero_sequencial, now())
    ON CONFLICT (unidade_id) DO UPDATE
      SET ultimo_numero = GREATEST(public.pedido_sequencias_unidade.ultimo_numero, EXCLUDED.ultimo_numero),
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_numero_pedido ON public.pedidos;
CREATE TRIGGER trg_assign_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assign_numero_pedido();

-- Nova RPC usada pela Nova Venda para mostrar a prévia correta da unidade selecionada.
CREATE OR REPLACE FUNCTION public.proximo_numero_pedido_unidade(_unidade_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT s.ultimo_numero
       FROM public.pedido_sequencias_unidade s
      WHERE s.unidade_id = _unidade_id),
    (SELECT MAX(p.numero_sequencial)
       FROM public.pedidos p
      WHERE p.unidade_id = _unidade_id),
    0
  ) + 1;
$$;

GRANT EXECUTE ON FUNCTION public.proximo_numero_pedido_unidade(uuid) TO authenticated;

COMMENT ON FUNCTION public.proximo_numero_pedido_unidade(uuid)
  IS 'Retorna o próximo número de pedido da unidade/loja selecionada.';
