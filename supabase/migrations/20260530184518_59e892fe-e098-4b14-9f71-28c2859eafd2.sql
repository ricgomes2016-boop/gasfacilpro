-- Backfill profiles.empresa_id for partner users based on their vale_gas_parceiros.unidade_id
UPDATE public.profiles p
SET empresa_id = u.empresa_id
FROM public.vale_gas_parceiros vp
JOIN public.unidades u ON u.id = vp.unidade_id
WHERE p.user_id = vp.user_id
  AND vp.user_id IS NOT NULL
  AND u.empresa_id IS NOT NULL
  AND (p.empresa_id IS NULL OR p.empresa_id <> u.empresa_id);

-- Trigger function: sync profiles.empresa_id whenever a parceiro is linked to a user
CREATE OR REPLACE FUNCTION public.fn_sync_parceiro_profile_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  IF NEW.user_id IS NULL OR NEW.unidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.unidades
  WHERE id = NEW.unidade_id;

  IF v_empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET empresa_id = v_empresa_id
  WHERE user_id = NEW.user_id
    AND (empresa_id IS NULL OR empresa_id <> v_empresa_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_parceiro_profile_empresa ON public.vale_gas_parceiros;

CREATE TRIGGER trg_sync_parceiro_profile_empresa
AFTER INSERT OR UPDATE OF user_id, unidade_id ON public.vale_gas_parceiros
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_parceiro_profile_empresa();