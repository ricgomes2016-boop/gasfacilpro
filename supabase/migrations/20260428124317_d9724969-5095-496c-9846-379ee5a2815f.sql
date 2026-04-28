ALTER TABLE public.pedidos
ALTER COLUMN data_entrega SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);