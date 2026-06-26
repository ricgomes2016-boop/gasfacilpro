-- Reparo complementar da numeração histórica por unidade.
-- A regra anterior da aplicação usava sequência global por empresa.
-- Uma unidade que nunca teve pedido #1 herdou números de outra loja;
-- nesses casos, renumera os pedidos existentes a partir de #1.
-- Unidades que já possuem sua própria sequência iniciada em #1 são preservadas.

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
  JOIN unidades_sem_sequencia_propria u
    ON u.unidade_id = p.unidade_id
)
UPDATE public.pedidos p
SET numero_sequencial = r.novo_numero
FROM renumerados r
WHERE p.id = r.id;

-- Recalcula os contadores após a correção histórica.
INSERT INTO public.pedido_sequencias_unidade (unidade_id, ultimo_numero, updated_at)
SELECT p.unidade_id, COALESCE(MAX(p.numero_sequencial), 0), now()
FROM public.pedidos p
WHERE p.unidade_id IS NOT NULL
GROUP BY p.unidade_id
ON CONFLICT (unidade_id) DO UPDATE
SET ultimo_numero = EXCLUDED.ultimo_numero,
    updated_at = now();
