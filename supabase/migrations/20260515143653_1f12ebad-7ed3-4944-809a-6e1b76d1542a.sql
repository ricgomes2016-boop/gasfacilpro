
CREATE TABLE IF NOT EXISTS public.certidoes_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('anp','cnd_federal','cnd_estadual','cnd_municipal','cndt','sintegra')),
  numero text,
  data_emissao date,
  data_vencimento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('regular','irregular','pendente','vencida','erro')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('automatica','manual')),
  arquivo_url text,
  arquivo_nome text,
  dados_json jsonb,
  ultimo_erro text,
  ultima_consulta_at timestamptz,
  proxima_consulta_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (unidade_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_certidoes_empresa_unidade ON public.certidoes_empresa(unidade_id);
CREATE INDEX IF NOT EXISTS idx_certidoes_empresa_empresa ON public.certidoes_empresa(empresa_id);
CREATE INDEX IF NOT EXISTS idx_certidoes_empresa_vencimento ON public.certidoes_empresa(data_vencimento);

ALTER TABLE public.certidoes_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem certidões da sua empresa"
ON public.certidoes_empresa FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.contador_has_empresa(auth.uid(), empresa_id)
);

CREATE POLICY "Admin/gestor inserem certidões"
ON public.certidoes_empresa FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = public.get_user_empresa_id()
  AND public.unidade_belongs_to_user_empresa(unidade_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  )
);

CREATE POLICY "Admin/gestor atualizam certidões"
ON public.certidoes_empresa FOR UPDATE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  )
);

CREATE POLICY "Admin/gestor deletam certidões"
ON public.certidoes_empresa FOR DELETE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  )
);

CREATE TRIGGER trg_certidoes_empresa_updated_at
BEFORE UPDATE ON public.certidoes_empresa
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket de storage para os PDFs das certidões
INSERT INTO storage.buckets (id, name, public)
VALUES ('certidoes-empresa', 'certidoes-empresa', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Empresa lê seus próprios PDFs de certidão"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certidoes-empresa'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Admin/gestor faz upload de certidões"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certidoes-empresa'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  )
);

CREATE POLICY "Admin/gestor atualiza PDFs de certidão"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certidoes-empresa'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Admin/gestor deleta PDFs de certidão"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'certidoes-empresa'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  )
);
