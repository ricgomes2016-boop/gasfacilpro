-- Garante que toda nova empresa tenha uma unidade matriz automaticamente
CREATE OR REPLACE FUNCTION public.fn_create_default_unidade_for_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Evita duplicidade caso outro fluxo já tenha criado unidade
  IF NOT EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.empresa_id = NEW.id
  ) THEN
    INSERT INTO public.unidades (
      nome,
      tipo,
      empresa_id,
      ativo
    ) VALUES (
      'Matriz',
      'matriz',
      NEW.id,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_unidade_for_empresa ON public.empresas;
CREATE TRIGGER trg_create_default_unidade_for_empresa
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_default_unidade_for_empresa();