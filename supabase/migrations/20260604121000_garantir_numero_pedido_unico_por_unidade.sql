-- Garante que uma mesma unidade nunca receba dois pedidos com o mesmo número.
-- Números iguais continuam permitidos entre lojas diferentes, como esperado.

CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_unidade_numero_sequencial
  ON public.pedidos (unidade_id, numero_sequencial)
  WHERE unidade_id IS NOT NULL AND numero_sequencial IS NOT NULL;
