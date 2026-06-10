
ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS gas_do_povo_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gas_do_povo_valor numeric(10,2) NOT NULL DEFAULT 101.08;

COMMENT ON COLUMN public.unidades.gas_do_povo_habilitado IS 'Habilita Gás do Povo como forma de pagamento no PDV';
COMMENT ON COLUMN public.unidades.gas_do_povo_valor IS 'Valor unitário do Gás do Povo definido pelo governo estadual';
