-- ============================================
-- 1) TABELA: contador_empresas
-- ============================================
CREATE TABLE IF NOT EXISTS public.contador_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contador_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  permissoes jsonb NOT NULL DEFAULT '{"xml":true,"despesas":true,"financeiro":true,"documentos":true}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contador_user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_contador_empresas_user ON public.contador_empresas(contador_user_id);
CREATE INDEX IF NOT EXISTS idx_contador_empresas_empresa ON public.contador_empresas(empresa_id);

ALTER TABLE public.contador_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contador vê seus próprios vínculos"
  ON public.contador_empresas FOR SELECT
  USING (contador_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin/super_admin gerencia vínculos"
  ON public.contador_empresas FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_contador_empresas_updated
  BEFORE UPDATE ON public.contador_empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2) FUNÇÃO: get_contador_empresas
-- ============================================
CREATE OR REPLACE FUNCTION public.get_contador_empresas(_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  empresa_id uuid,
  empresa_nome text,
  empresa_slug text,
  empresa_logo_url text,
  permissoes jsonb,
  total_unidades bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    e.id AS empresa_id,
    e.nome AS empresa_nome,
    e.slug AS empresa_slug,
    e.logo_url AS empresa_logo_url,
    ce.permissoes,
    (SELECT COUNT(*) FROM public.unidades u WHERE u.empresa_id = e.id AND u.ativo = true) AS total_unidades
  FROM public.contador_empresas ce
  JOIN public.empresas e ON e.id = ce.empresa_id
  WHERE ce.contador_user_id = COALESCE(_user_id, auth.uid())
    AND ce.ativo = true
  ORDER BY e.nome;
$$;

-- Helper: contador tem acesso à empresa?
CREATE OR REPLACE FUNCTION public.contador_has_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contador_empresas
    WHERE contador_user_id = _user_id
      AND empresa_id = _empresa_id
      AND ativo = true
  );
$$;

-- ============================================
-- 3) TABELA: despesas_contabeis
-- ============================================
CREATE TABLE IF NOT EXISTS public.despesas_contabeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  fornecedor text,
  cnpj_fornecedor text,
  data_despesa date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  categoria text,
  plano_conta_id uuid,
  forma_pagamento text,
  arquivo_url text,
  arquivo_nome text,
  arquivo_mime text,
  ocr_texto text,
  ocr_metadata jsonb,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','classificada','baixada','rejeitada')),
  observacoes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contador_baixou_em timestamptz,
  contador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_despesas_cont_empresa ON public.despesas_contabeis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_despesas_cont_unidade ON public.despesas_contabeis(unidade_id);
CREATE INDEX IF NOT EXISTS idx_despesas_cont_data ON public.despesas_contabeis(data_despesa DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_cont_status ON public.despesas_contabeis(status);

ALTER TABLE public.despesas_contabeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff da empresa vê despesas"
  ON public.despesas_contabeis FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Staff e contador inserem despesas"
  ON public.despesas_contabeis FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
  );

CREATE POLICY "Staff e contador atualizam despesas"
  ON public.despesas_contabeis FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admin/gestor remove despesas"
  ON public.despesas_contabeis FOR DELETE
  USING (
    (empresa_id = public.get_user_empresa_id() AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER trg_despesas_cont_updated
  BEFORE UPDATE ON public.despesas_contabeis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4) TABELA: plano_contas
-- ============================================
CREATE TABLE IF NOT EXISTS public.plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ativo','passivo','patrimonio','receita','despesa','custo')),
  natureza text NOT NULL DEFAULT 'debito' CHECK (natureza IN ('debito','credito')),
  conta_pai_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_plano_contas_empresa ON public.plano_contas(empresa_id);

ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/contador vê plano de contas"
  ON public.plano_contas FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Staff/contador insere plano de contas"
  ON public.plano_contas FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
  );

CREATE POLICY "Staff/contador atualiza plano de contas"
  ON public.plano_contas FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
  );

CREATE POLICY "Admin/gestor remove plano de contas"
  ON public.plano_contas FOR DELETE
  USING (
    (empresa_id = public.get_user_empresa_id() AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER trg_plano_contas_updated
  BEFORE UPDATE ON public.plano_contas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.despesas_contabeis
  ADD CONSTRAINT fk_despesas_plano_conta
  FOREIGN KEY (plano_conta_id) REFERENCES public.plano_contas(id) ON DELETE SET NULL;

-- ============================================
-- 5) STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('contabil-xmls', 'contabil-xmls', false),
  ('contabil-despesas', 'contabil-despesas', false),
  ('contabil-extratos', 'contabil-extratos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — XMLs
CREATE POLICY "Contador/staff lê XMLs contábeis"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contabil-xmls' AND (
      auth.uid() IS NOT NULL
    )
  );

CREATE POLICY "Contador/staff envia XMLs contábeis"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contabil-xmls' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contador/staff remove XMLs contábeis"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contabil-xmls' AND auth.uid() IS NOT NULL);

-- Storage policies — Despesas
CREATE POLICY "Contador/staff lê despesas escaneadas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contabil-despesas' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contador/staff envia despesas escaneadas"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contabil-despesas' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contador/staff remove despesas escaneadas"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contabil-despesas' AND auth.uid() IS NOT NULL);

-- Storage policies — Extratos
CREATE POLICY "Contador/staff lê extratos contábeis"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contabil-extratos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contador/staff envia extratos contábeis"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contabil-extratos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contador/staff remove extratos contábeis"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contabil-extratos' AND auth.uid() IS NOT NULL);