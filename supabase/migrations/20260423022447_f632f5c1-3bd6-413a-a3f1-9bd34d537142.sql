
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_accounts_empresa_plat_external
ON public.social_accounts(empresa_id, plataforma, external_id)
WHERE external_id IS NOT NULL;
