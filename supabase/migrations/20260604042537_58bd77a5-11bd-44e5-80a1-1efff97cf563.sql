-- Corrige numeração de pedidos para ser estritamente por unidade (loja),
-- substituindo a função ativa que ainda calculava por empresa.
-- Também renumera pedidos da Japa Gás (e quaisquer unidades que ainda
-- não tenham sequência local iniciada em #1) começando do 1 em ordem
-- cronológica, mantendo a sequência da matriz/unidade principal.

-- 1) Garantir tabela de contador por unidade
CREATE TABLE IF NOT EXISTS public.pedido_sequencias_unidade (
  unidade_id uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  ultimo_numero integer NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_sequencias_unidade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_sequencias_unidade FROM anon, authenticated;

-- 2) Renumerar pedidos de unidades que ainda não possuem sequência local iniciada em #1
WITH unidades_sem_sequencia_propria AS (
  SELECT p.unidade_id
  FROM public.pedidos p
  WHERE p.unidade_id IS NOT NULL
  GROUP BY p.unidade_id
  HAVING COUNT(*) FILTER (WHERE p.numero_sequencial = 1) = 0
),
renumerados AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.unidade_id
      ORDER BY p.created_at ASC, p.id ASC
    )::integer AS novo_numero
  FROM public.pedidos p
  JOIN unidades_sem_sequencia_propria u ON u.unidade_id = p.unidade_id
)
UPDATE public.pedidos p
SET numero_sequencial = r.novo_numero
FROM renumerados r
WHERE p.id = r.id;

-- 3) Reinicializa contadores por unidade com base nos números atuais
INSERT INTO public.pedido_sequencias_unidade (unidade_id, ultimo_numero, updated_at)
SELECT p.unidade_id, COALESCE(MAX(p.numero_sequencial), 0), now()
FROM public.pedidos p
WHERE p.unidade_id IS NOT NULL
GROUP BY p.unidade_id
ON CONFLICT (unidade_id) DO UPDATE
SET ultimo_numero = EXCLUDED.ultimo_numero,
    updated_at = now();

-- 4) Substitui a função de atribuição para usar SOMENTE unidade_id (atômico)
CREATE OR REPLACE FUNCTION public.fn_assign_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
BEGIN
  -- Compatibilidade para registros legados sem unidade
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

-- 5) RPC de preview para a tela Nova Venda
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

-- 6) Índice único por (unidade_id, numero_sequencial) para impedir regressões
CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_unidade_numero_sequencial
  ON public.pedidos (unidade_id, numero_sequencial)
  WHERE unidade_id IS NOT NULL AND numero_sequencial IS NOT NULL;