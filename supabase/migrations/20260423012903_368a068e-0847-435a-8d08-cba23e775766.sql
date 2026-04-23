CREATE TABLE public.marketing_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  unidade_id uuid,
  url text NOT NULL,
  titulo text,
  tags text,
  origem text NOT NULL CHECK (origem IN ('ia','importada')),
  prompt text,
  favorito boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_imagens_empresa ON public.marketing_imagens(empresa_id, created_at DESC);

ALTER TABLE public.marketing_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa users can view marketing images"
  ON public.marketing_imagens FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Empresa users can insert marketing images"
  ON public.marketing_imagens FOR INSERT
  TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Empresa users can update marketing images"
  ON public.marketing_imagens FOR UPDATE
  TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Empresa users can delete marketing images"
  ON public.marketing_imagens FOR DELETE
  TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER trg_marketing_imagens_updated_at
  BEFORE UPDATE ON public.marketing_imagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();