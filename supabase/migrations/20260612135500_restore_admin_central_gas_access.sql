DO $$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_unidade_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'admin@gasfacil.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'admin@gasfacil.com not found; skipping access repair';
    RETURN;
  END IF;

  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE slug IN ('central-gas', 'centralgas', 'central-gas-cp')
     OR lower(nome) IN ('central gas', 'central gás')
  ORDER BY created_at
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    INSERT INTO public.empresas (
      nome, slug, plano, plano_max_unidades, plano_max_usuarios, ativo
    )
    VALUES (
      'Central Gas', 'central-gas', 'profissional', 10, 50, true
    )
    RETURNING id INTO v_empresa_id;
  END IF;

  SELECT id INTO v_unidade_id
  FROM public.unidades
  WHERE empresa_id = v_empresa_id
    AND (lower(nome) IN ('central gas', 'central gás') OR tipo = 'matriz')
  ORDER BY CASE WHEN lower(nome) IN ('central gas', 'central gás') THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_unidade_id IS NULL THEN
    INSERT INTO public.unidades (nome, tipo, empresa_id, ativo)
    VALUES ('Central Gas', 'matriz', v_empresa_id, true)
    RETURNING id INTO v_unidade_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, empresa_id)
  VALUES (v_user_id, 'Ricardo', 'admin@gasfacil.com', v_empresa_id)
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
      email = EXCLUDED.email,
      empresa_id = EXCLUDED.empresa_id,
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES
    (v_user_id, 'admin'::public.app_role),
    (v_user_id, 'gestor'::public.app_role),
    (v_user_id, 'financeiro'::public.app_role),
    (v_user_id, 'operacional'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_unidades (user_id, unidade_id)
  SELECT v_user_id, u.id
  FROM public.unidades u
  WHERE u.empresa_id = v_empresa_id
  ON CONFLICT (user_id, unidade_id) DO NOTHING;

  NOTIFY pgrst, 'reload schema';
END $$;
