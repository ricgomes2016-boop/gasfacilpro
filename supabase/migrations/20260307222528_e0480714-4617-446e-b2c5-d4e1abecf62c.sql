DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@gasfacil.com';
  
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Admin GasFácil', empresa_id = 'f27e158e-7ab5-4617-9f66-c6b4a084d293' WHERE user_id = v_user_id;
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
  ELSE
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, 
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'admin@gasfacil.com',
      crypt('123456', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin GasFácil","email_verified":true}'::jsonb,
      'authenticated', 'authenticated', ''
    );
    
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_user_id, v_user_id, 'admin@gasfacil.com',
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@gasfacil.com', 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
    
    UPDATE public.profiles SET empresa_id = 'f27e158e-7ab5-4617-9f66-c6b4a084d293', full_name = 'Admin GasFácil' WHERE user_id = v_user_id;
    
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
  END IF;
END;
$$