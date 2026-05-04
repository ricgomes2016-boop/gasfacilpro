
ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual_st text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS regime_tributario text,
  ADD COLUMN IF NOT EXISTS certificado_a1_path text,
  ADD COLUMN IF NOT EXISTS certificado_a1_senha text,
  ADD COLUMN IF NOT EXISTS certificado_a1_validade date,
  ADD COLUMN IF NOT EXISTS certificado_a1_titular text,
  ADD COLUMN IF NOT EXISTS nfe_ambiente text DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS nfe_serie integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfe_proximo_numero integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfce_serie integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfce_proximo_numero integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfce_csc_id text,
  ADD COLUMN IF NOT EXISTS nfce_csc_token text,
  ADD COLUMN IF NOT EXISTS cte_serie integer,
  ADD COLUMN IF NOT EXISTS cte_proximo_numero integer,
  ADD COLUMN IF NOT EXISTS cfop_padrao_venda text,
  ADD COLUMN IF NOT EXISTS cfop_padrao_devolucao text,
  ADD COLUMN IF NOT EXISTS natureza_operacao_padrao text,
  ADD COLUMN IF NOT EXISTS aliquota_icms_padrao numeric(5,2),
  ADD COLUMN IF NOT EXISTS aliquota_pis_padrao numeric(5,2),
  ADD COLUMN IF NOT EXISTS aliquota_cofins_padrao numeric(5,2),
  ADD COLUMN IF NOT EXISTS cst_csosn_padrao text,
  ADD COLUMN IF NOT EXISTS contador_nome text,
  ADD COLUMN IF NOT EXISTS contador_cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS contador_crc text,
  ADD COLUMN IF NOT EXISTS contador_email text,
  ADD COLUMN IF NOT EXISTS contador_telefone text,
  ADD COLUMN IF NOT EXISTS provedor_nfe text,
  ADD COLUMN IF NOT EXISTS provedor_nfe_token text,
  ADD COLUMN IF NOT EXISTS provedor_nfe_url text;

-- Bucket privado para certificados digitais
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados-fiscais', 'certificados-fiscais', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage: admin/gestor da empresa podem gerenciar arquivos sob "<empresa_id>/..."
DO $$ BEGIN
  CREATE POLICY "Certificados: gestores leem da própria empresa"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'certificados-fiscais'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Certificados: gestores enviam para a própria empresa"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'certificados-fiscais'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Certificados: gestores atualizam da própria empresa"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'certificados-fiscais'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Certificados: gestores apagam da própria empresa"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'certificados-fiscais'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
