ALTER TABLE public.estoque_conferencia_movimentos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.estoque_conferencia_movimentos m SET empresa_id = u.empresa_id FROM public.unidades u WHERE u.id = m.unidade_id AND m.empresa_id IS NULL;
CREATE OR REPLACE FUNCTION public.fn_ecm_validate_empresa() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE origem_empresa uuid; destino_empresa uuid;
BEGIN
  SELECT empresa_id INTO origem_empresa FROM public.unidades WHERE id = NEW.unidade_id;
  IF origem_empresa IS NULL THEN RAISE EXCEPTION 'Loja de origem sem empresa vinculada'; END IF;
  IF NEW.empresa_id IS NOT NULL AND NEW.empresa_id IS DISTINCT FROM origem_empresa THEN RAISE EXCEPTION 'Empresa não corresponde à loja de origem'; END IF;
  NEW.empresa_id := origem_empresa;
  IF NEW.unidade_destino_id IS NOT NULL THEN
    SELECT empresa_id INTO destino_empresa FROM public.unidades WHERE id = NEW.unidade_destino_id;
    IF destino_empresa IS DISTINCT FROM origem_empresa THEN RAISE EXCEPTION 'Destino não pertence à empresa da origem'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ecm_validate_empresa BEFORE INSERT OR UPDATE ON public.estoque_conferencia_movimentos FOR EACH ROW EXECUTE FUNCTION public.fn_ecm_validate_empresa();
CREATE INDEX IF NOT EXISTS idx_ecm_empresa_data ON public.estoque_conferencia_movimentos(empresa_id, data_conferencia);
NOTIFY pgrst, 'reload schema';