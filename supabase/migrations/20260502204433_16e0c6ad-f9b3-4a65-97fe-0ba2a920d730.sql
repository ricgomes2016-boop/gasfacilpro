-- 1) Coluna preenchida via trigger (não generated, pois extract sobre timestamptz não é IMMUTABLE)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS created_minute bigint;

-- 2) Trigger para preencher antes do INSERT
CREATE OR REPLACE FUNCTION public.fn_set_pedido_created_minute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.created_minute IS NULL THEN
    NEW.created_minute := floor(extract(epoch from COALESCE(NEW.created_at, now())) / 60)::bigint;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pedido_created_minute ON public.pedidos;
CREATE TRIGGER trg_set_pedido_created_minute
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_pedido_created_minute();

-- 3) Backfill nos registros existentes
UPDATE public.pedidos
SET created_minute = floor(extract(epoch from created_at) / 60)::bigint
WHERE created_minute IS NULL;

-- 4) Índice único parcial: bloqueia duplicados telefone_ia mesmo cliente/unidade/minuto
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_telefone_ia_dedupe
ON public.pedidos (cliente_id, unidade_id, created_minute)
WHERE canal_venda = 'telefone_ia';