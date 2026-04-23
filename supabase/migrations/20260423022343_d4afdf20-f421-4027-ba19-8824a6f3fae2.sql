
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS access_token text;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS refresh_token text;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS page_id text;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS ig_business_id text;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS scopes text[];
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS conectado_via text NOT NULL DEFAULT 'manual';
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_social_accounts_empresa_via ON public.social_accounts(empresa_id, conectado_via);
