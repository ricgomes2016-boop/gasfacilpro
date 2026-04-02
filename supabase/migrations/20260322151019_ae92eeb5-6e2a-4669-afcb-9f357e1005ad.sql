
-- Social accounts per empresa/unidade
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  plataforma text NOT NULL CHECK (plataforma IN ('instagram', 'facebook', 'tiktok', 'youtube')),
  nome_conta text NOT NULL,
  username text,
  token text,
  refresh_token text,
  token_expires_at timestamptz,
  avatar_url text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_accounts_select" ON public.social_accounts FOR SELECT TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id) OR empresa_id = public.get_user_empresa_id());
CREATE POLICY "social_accounts_insert" ON public.social_accounts FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "social_accounts_update" ON public.social_accounts FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "social_accounts_delete" ON public.social_accounts FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Marketing content library
CREATE TABLE public.marketing_conteudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'video', 'carrossel')),
  plataforma text,
  titulo text,
  conteudo text,
  hashtags text,
  midia_url text,
  tom text DEFAULT 'profissional',
  favorito boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_conteudos_select" ON public.marketing_conteudos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_conteudos_insert" ON public.marketing_conteudos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_conteudos_update" ON public.marketing_conteudos FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_conteudos_delete" ON public.marketing_conteudos FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Scheduled posts
CREATE TABLE public.marketing_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  conteudo_id uuid REFERENCES public.marketing_conteudos(id) ON DELETE SET NULL,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  plataforma text NOT NULL,
  data_agendamento timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'publicado', 'falhou', 'cancelado')),
  texto text,
  midia_url text,
  hashtags text,
  resultado_publicacao jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_agend_select" ON public.marketing_agendamentos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_agend_insert" ON public.marketing_agendamentos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_agend_update" ON public.marketing_agendamentos FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_agend_delete" ON public.marketing_agendamentos FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Engagement metrics
CREATE TABLE public.marketing_metricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  agendamento_id uuid REFERENCES public.marketing_agendamentos(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  plataforma text NOT NULL,
  data_metrica date NOT NULL DEFAULT CURRENT_DATE,
  alcance integer DEFAULT 0,
  impressoes integer DEFAULT 0,
  curtidas integer DEFAULT 0,
  comentarios integer DEFAULT 0,
  compartilhamentos integer DEFAULT 0,
  cliques integer DEFAULT 0,
  conversoes integer DEFAULT 0,
  pedidos_gerados integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_metricas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_metricas_select" ON public.marketing_metricas FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_metricas_insert" ON public.marketing_metricas FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Automated support flows
CREATE TABLE public.marketing_fluxos_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  nome text NOT NULL,
  intencao text NOT NULL CHECK (intencao IN ('pedido', 'duvida', 'reclamacao', 'promocao', 'suporte', 'outro')),
  mensagem_inicial text,
  passos jsonb DEFAULT '[]'::jsonb,
  transferir_humano boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_fluxos_atendimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_fluxos_select" ON public.marketing_fluxos_atendimento FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_fluxos_insert" ON public.marketing_fluxos_atendimento FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_fluxos_update" ON public.marketing_fluxos_atendimento FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_fluxos_delete" ON public.marketing_fluxos_atendimento FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Conversation history
CREATE TABLE public.marketing_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  plataforma text NOT NULL DEFAULT 'whatsapp',
  telefone text,
  nome_contato text,
  intencao_detectada text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'resolvido', 'transferido', 'arquivado')),
  fluxo_id uuid REFERENCES public.marketing_fluxos_atendimento(id) ON DELETE SET NULL,
  mensagens jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_conversas_select" ON public.marketing_conversas FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_conversas_insert" ON public.marketing_conversas FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "mkt_conversas_update" ON public.marketing_conversas FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
