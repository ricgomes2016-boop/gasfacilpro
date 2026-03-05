
-- 1. Add slug column to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Generate slugs for existing empresas based on nome
UPDATE public.empresas 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(nome, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- 3. Make slug unique and not null
ALTER TABLE public.empresas ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS empresas_slug_unique ON public.empresas (slug);

-- 4. Update handle_new_user to link clients to empresa via slug in metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_empresa_slug text;
  v_empresa_id uuid;
BEGIN
  -- Check if empresa slug was passed in metadata
  v_empresa_slug := NEW.raw_user_meta_data->>'empresa_slug';
  
  IF v_empresa_slug IS NOT NULL AND v_empresa_slug != '' THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = v_empresa_slug LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_empresa_id
  );
  
  -- Default role is 'cliente' for self-registered users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente');
  
  -- If empresa found, also create a clientes record
  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public.clientes (nome, email, telefone, empresa_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      v_empresa_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Create a public function to resolve empresa by slug (no auth needed)
CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(_slug text)
RETURNS TABLE(id uuid, nome text, slug text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT e.id, e.nome, e.slug, e.logo_url
  FROM public.empresas e
  WHERE e.slug = _slug
  LIMIT 1;
$$;
