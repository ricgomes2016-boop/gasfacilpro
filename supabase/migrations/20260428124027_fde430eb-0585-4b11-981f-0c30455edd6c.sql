ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS data_entrega date;

UPDATE public.pedidos
SET data_entrega = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data_entrega IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_data_entrega
ON public.pedidos (data_entrega);

CREATE INDEX IF NOT EXISTS idx_pedidos_unidade_data_entrega
ON public.pedidos (unidade_id, data_entrega);