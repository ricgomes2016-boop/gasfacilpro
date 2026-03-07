
CREATE TABLE public.integracoes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  integracao_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, integracao_id)
);

ALTER TABLE public.integracoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view integracoes_config of their empresa units"
  ON public.integracoes_config FOR SELECT TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "Admins/gestors can manage integracoes_config"
  ON public.integracoes_config FOR ALL TO authenticated
  USING (
    public.unidade_belongs_to_user_empresa(unidade_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  )
  WITH CHECK (
    public.unidade_belongs_to_user_empresa(unidade_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  );
