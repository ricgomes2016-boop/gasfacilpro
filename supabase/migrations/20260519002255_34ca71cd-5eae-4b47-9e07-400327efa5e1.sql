-- Remove possible duplicates, keeping the most recently updated row per empresa
DELETE FROM public.configuracoes_empresa a
USING public.configuracoes_empresa b
WHERE a.empresa_id = b.empresa_id
  AND a.id < b.id;

ALTER TABLE public.configuracoes_empresa
  ADD CONSTRAINT configuracoes_empresa_empresa_id_key UNIQUE (empresa_id);