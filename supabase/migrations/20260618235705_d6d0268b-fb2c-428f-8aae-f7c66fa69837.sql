ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS status_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_atraso_enviado_em timestamptz;

UPDATE public.pedidos
SET status_atualizado_em = COALESCE(updated_at, created_at)
WHERE status_atualizado_em IS NULL;

ALTER TABLE public.pedidos
  ALTER COLUMN status_atualizado_em SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.pedidos_track_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_atualizado_em := now();
    NEW.alerta_atraso_enviado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_track_status_change ON public.pedidos;
CREATE TRIGGER trg_pedidos_track_status_change
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.pedidos_track_status_change();

CREATE INDEX IF NOT EXISTS idx_pedidos_status_atualizado_em
  ON public.pedidos (status_atualizado_em)
  WHERE alerta_atraso_enviado_em IS NULL;