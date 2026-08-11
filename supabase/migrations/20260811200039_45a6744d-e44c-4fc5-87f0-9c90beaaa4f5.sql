UPDATE public.integracoes_whatsapp
SET meta_verify_token = COALESCE(meta_verify_token, encode(gen_random_bytes(24), 'hex')),
    updated_at = now()
WHERE unidade_id = '3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05';