CREATE OR REPLACE FUNCTION public.prevent_profile_empresa_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only applies to authenticated end-user inserts (signup trigger runs with auth.uid() null)
  IF auth.uid() IS NOT NULL
     AND NEW.empresa_id IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND NEW.empresa_id IS DISTINCT FROM public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Não é permitido definir a empresa do próprio perfil';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_empresa_insert ON public.profiles;
CREATE TRIGGER trg_prevent_profile_empresa_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_empresa_insert();