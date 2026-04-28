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
  v_codigo_indicacao text;
BEGIN
  v_empresa_slug := NEW.raw_user_meta_data->>'empresa_slug';
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_codigo_indicacao := NULLIF(upper(trim(NEW.raw_user_meta_data->>'codigo_indicacao')), '');
  
  IF NEW.email LIKE '%@phone.gasfacilpro.app' THEN
    v_email := NULL;
  ELSE
    v_email := NEW.email;
  END IF;
  
  IF v_empresa_slug IS NOT NULL AND v_empresa_slug != '' THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = v_empresa_slug LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, phone, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(v_email, NEW.email),
    v_phone,
    v_empresa_id
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente');
  
  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public.clientes (nome, email, telefone, empresa_id, codigo_indicacao_usado)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      v_email,
      v_phone,
      v_empresa_id,
      v_codigo_indicacao
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Clientes can view their own referrals" ON public.cliente_indicacoes;
CREATE POLICY "Clientes can view their own referrals"
ON public.cliente_indicacoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.clientes c ON (
      (c.email IS NOT NULL AND p.email IS NOT NULL AND lower(c.email) = lower(p.email))
      OR (c.telefone IS NOT NULL AND p.phone IS NOT NULL AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g'))
    )
    WHERE p.user_id = auth.uid()
      AND c.id IN (cliente_indicacoes.indicador_cliente_id, cliente_indicacoes.indicado_cliente_id)
  )
);

DROP POLICY IF EXISTS "Clientes can view their own credits" ON public.cliente_creditos;
CREATE POLICY "Clientes can view their own credits"
ON public.cliente_creditos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.clientes c ON (
      (c.email IS NOT NULL AND p.email IS NOT NULL AND lower(c.email) = lower(p.email))
      OR (c.telefone IS NOT NULL AND p.phone IS NOT NULL AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g'))
    )
    WHERE p.user_id = auth.uid()
      AND c.id = cliente_creditos.cliente_id
  )
);