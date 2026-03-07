CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_slug text;
  v_empresa_id uuid;
  v_email text;
  v_phone text;
BEGIN
  -- Check if empresa slug was passed in metadata
  v_empresa_slug := NEW.raw_user_meta_data->>'empresa_slug';
  v_phone := NEW.raw_user_meta_data->>'phone';
  
  -- If email ends with @phone.gasfacilpro.app, it's a phone-based signup
  IF NEW.email LIKE '%@phone.gasfacilpro.app' THEN
    v_email := NULL;
  ELSE
    v_email := NEW.email;
  END IF;
  
  IF v_empresa_slug IS NOT NULL AND v_empresa_slug != '' THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = v_empresa_slug LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(v_email, NEW.email),
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
      v_email,
      v_phone,
      v_empresa_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;