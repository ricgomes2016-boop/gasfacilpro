ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS vale_gas_id uuid REFERENCES public.vale_gas(id),
  ADD COLUMN IF NOT EXISTS vale_gas_parceiro_id uuid REFERENCES public.vale_gas_parceiros(id),
  ADD COLUMN IF NOT EXISTS origem text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vale_gas_numero_unique ON public.vale_gas(numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vale_gas_codigo_unique ON public.vale_gas(codigo);
CREATE INDEX IF NOT EXISTS idx_contas_receber_vale_gas ON public.contas_receber(vale_gas_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_vale_gas_parceiro ON public.contas_receber(vale_gas_parceiro_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_origem ON public.contas_receber(origem);

CREATE OR REPLACE FUNCTION public.validar_conta_receber_vale_gas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.forma_pagamento = 'vale_gas' THEN
    IF NEW.vale_gas_id IS NOT NULL AND NEW.vale_gas_parceiro_id IS NULL THEN
      SELECT parceiro_id INTO NEW.vale_gas_parceiro_id
      FROM public.vale_gas
      WHERE id = NEW.vale_gas_id;
    END IF;

    IF NEW.cliente_id IS NOT NULL THEN
      NEW.cliente_id := NULL;
    END IF;

    IF NEW.origem IS NULL THEN
      NEW.origem := 'vale_gas';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_conta_receber_vale_gas ON public.contas_receber;
CREATE TRIGGER trg_validar_conta_receber_vale_gas
BEFORE INSERT OR UPDATE ON public.contas_receber
FOR EACH ROW
EXECUTE FUNCTION public.validar_conta_receber_vale_gas();