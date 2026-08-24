CREATE TABLE public.dfe_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nsu bigint,
  tipo_documento text NOT NULL DEFAULT 'resumo',
  schema_dfe text,
  cnpj_emitente text,
  nome_emitente text,
  ie_emitente text,
  numero text,
  serie text,
  valor_total numeric NOT NULL DEFAULT 0,
  data_emissao timestamptz,
  situacao_nfe text,
  digest_value text,
  manifestacao text,
  manifestacao_em timestamptz,
  xml_path text,
  xml_completo boolean NOT NULL DEFAULT false,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  compra_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dfe_documentos_chave_unidade_key UNIQUE (unidade_id, chave)
);

CREATE INDEX idx_dfe_documentos_unidade_emissao ON public.dfe_documentos (unidade_id, data_emissao DESC);
CREATE INDEX idx_dfe_documentos_chave ON public.dfe_documentos (chave);
CREATE INDEX idx_dfe_documentos_manifestacao ON public.dfe_documentos (unidade_id, manifestacao);

GRANT SELECT, INSERT, UPDATE ON public.dfe_documentos TO authenticated;
GRANT ALL ON public.dfe_documentos TO service_role;
ALTER TABLE public.dfe_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dfe_documentos_select" ON public.dfe_documentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.user_has_unidade(auth.uid(), unidade_id));

CREATE POLICY "dfe_documentos_update" ON public.dfe_documentos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.user_has_unidade(auth.uid(), unidade_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_has_unidade(auth.uid(), unidade_id));

CREATE TABLE public.dfe_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid REFERENCES public.dfe_documentos(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  empresa_id uuid,
  chave text NOT NULL,
  tipo_evento text NOT NULL,
  descricao text,
  sequencia integer NOT NULL DEFAULT 1,
  protocolo text,
  cstat text,
  xmotivo text,
  justificativa text,
  sucesso boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dfe_eventos_documento ON public.dfe_eventos (documento_id, created_at DESC);

GRANT SELECT ON public.dfe_eventos TO authenticated;
GRANT ALL ON public.dfe_eventos TO service_role;
ALTER TABLE public.dfe_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dfe_eventos_select" ON public.dfe_eventos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.user_has_unidade(auth.uid(), unidade_id));

CREATE TABLE public.dfe_nsu_estado (
  unidade_id uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  empresa_id uuid,
  ultimo_nsu bigint NOT NULL DEFAULT 0,
  max_nsu bigint NOT NULL DEFAULT 0,
  ultima_sincronizacao timestamptz,
  ultimo_cstat text,
  ultimo_xmotivo text,
  documentos_recebidos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dfe_nsu_estado TO authenticated;
GRANT ALL ON public.dfe_nsu_estado TO service_role;
ALTER TABLE public.dfe_nsu_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dfe_nsu_estado_select" ON public.dfe_nsu_estado
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.user_has_unidade(auth.uid(), unidade_id));

CREATE TRIGGER update_dfe_documentos_updated_at
  BEFORE UPDATE ON public.dfe_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dfe_nsu_estado_updated_at
  BEFORE UPDATE ON public.dfe_nsu_estado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();