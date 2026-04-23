-- Tabela de nonces OAuth (anti-replay)
CREATE TABLE public.oauth_states (
  nonce uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  unidade_id uuid,
  return_url text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas — só service role acessa
CREATE POLICY "service_role_only_oauth_states"
ON public.oauth_states
FOR ALL
USING (false)
WITH CHECK (false);

-- Tabela de configurações globais do SaaS
CREATE TABLE public.configuracoes_globais (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.configuracoes_globais ENABLE ROW LEVEL SECURITY;

-- Todo usuário autenticado pode ler (necessário para o banner)
CREATE POLICY "authenticated_read_config_globais"
ON public.configuracoes_globais
FOR SELECT
TO authenticated
USING (true);

-- Só super_admin pode alterar
CREATE POLICY "super_admin_manage_config_globais"
ON public.configuracoes_globais
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed inicial
INSERT INTO public.configuracoes_globais (chave, valor, descricao)
VALUES (
  'meta_app_review_status',
  '"dev"'::jsonb,
  'Status do app Meta: "dev" (só testadores) ou "approved" (público)'
);

CREATE TRIGGER trg_config_globais_updated_at
BEFORE UPDATE ON public.configuracoes_globais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();