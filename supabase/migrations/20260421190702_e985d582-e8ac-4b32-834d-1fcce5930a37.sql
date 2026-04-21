
-- Tabela de log/registro das importações inteligentes
CREATE TABLE public.importacoes_inteligentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  origem TEXT NOT NULL DEFAULT 'contador', -- contador, gestor, admin
  destino TEXT NOT NULL DEFAULT 'auto',    -- xml, despesa, financeiro, auto
  arquivo_nome TEXT NOT NULL,
  arquivo_path TEXT,
  arquivo_mime TEXT,
  arquivo_tamanho BIGINT,
  tipo_detectado TEXT,                      -- xml_nfe, xml_nfce, xml_cte, pdf_nota, pdf_boleto, ofx, csv_extrato, xlsx, zip, rar, desconhecido
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente, processando, concluido, parcial, erro, revisao
  confianca NUMERIC(4,3),                   -- 0.000 a 1.000
  cnpj_detectado TEXT,
  registros_processados INT DEFAULT 0,
  registros_criados INT DEFAULT 0,
  registros_duplicados INT DEFAULT 0,
  registros_erro INT DEFAULT 0,
  dados_extraidos JSONB,
  mensagem_erro TEXT,
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_imp_int_empresa ON public.importacoes_inteligentes(empresa_id);
CREATE INDEX idx_imp_int_unidade ON public.importacoes_inteligentes(unidade_id);
CREATE INDEX idx_imp_int_status ON public.importacoes_inteligentes(status);
CREATE INDEX idx_imp_int_created ON public.importacoes_inteligentes(created_at DESC);

ALTER TABLE public.importacoes_inteligentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contador/admin/gestor podem ver importacoes da empresa"
ON public.importacoes_inteligentes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.contador_has_empresa(auth.uid(), empresa_id)
  OR (public.get_user_empresa_id() = empresa_id
      AND (public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'gestor'::app_role)
           OR public.has_role(auth.uid(), 'financeiro'::app_role)))
);

CREATE POLICY "Contador/admin/gestor podem criar importacoes"
ON public.importacoes_inteligentes FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.contador_has_empresa(auth.uid(), empresa_id)
    OR (public.get_user_empresa_id() = empresa_id
        AND (public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'gestor'::app_role)
             OR public.has_role(auth.uid(), 'financeiro'::app_role)))
  )
);

CREATE POLICY "Contador/admin/gestor podem atualizar importacoes"
ON public.importacoes_inteligentes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.contador_has_empresa(auth.uid(), empresa_id)
  OR (public.get_user_empresa_id() = empresa_id
      AND (public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'gestor'::app_role)))
);

CREATE POLICY "Contador/admin/gestor podem deletar importacoes"
ON public.importacoes_inteligentes FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (public.get_user_empresa_id() = empresa_id
      AND (public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'gestor'::app_role)))
);

CREATE TRIGGER update_imp_int_updated_at
BEFORE UPDATE ON public.importacoes_inteligentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para armazenar arquivos originais
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contabil-importacoes', 'contabil-importacoes', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: pasta = empresa_id/...
CREATE POLICY "Contador/admin/gestor podem ler importacoes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contabil-importacoes' AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.user_can_access_contabil_path(name)
  )
);

CREATE POLICY "Contador/admin/gestor podem subir importacoes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contabil-importacoes' AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.user_can_access_contabil_path(name)
  )
);

CREATE POLICY "Contador/admin/gestor podem deletar importacoes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contabil-importacoes' AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.user_can_access_contabil_path(name)
  )
);
