UPDATE public.integracoes_whatsapp
SET token = meta_access_token
WHERE provedor = 'meta'
  AND meta_access_token IS NOT NULL
  AND (token IS NULL OR token <> meta_access_token);