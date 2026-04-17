
CREATE TABLE public.transp_outlook_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  microsoft_user_email TEXT,
  microsoft_refresh_token TEXT,
  filtro_remetente TEXT,
  ultima_importacao TIMESTAMPTZ,
  ultimo_status TEXT,
  ultimo_total_importados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transp_outlook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view outlook config of their empresa"
ON public.transp_outlook_config FOR SELECT TO authenticated
USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Users insert outlook config for their empresa"
ON public.transp_outlook_config FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Users update outlook config of their empresa"
ON public.transp_outlook_config FOR UPDATE TO authenticated
USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Users delete outlook config of their empresa"
ON public.transp_outlook_config FOR DELETE TO authenticated
USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE TRIGGER set_transp_outlook_config_updated_at
BEFORE UPDATE ON public.transp_outlook_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transp_compras
  ADD COLUMN IF NOT EXISTS chave_nfe TEXT,
  ADD COLUMN IF NOT EXISTS numero_nf TEXT,
  ADD COLUMN IF NOT EXISTS outlook_message_id TEXT,
  ADD COLUMN IF NOT EXISTS produto_descricao TEXT,
  ADD COLUMN IF NOT EXISTS cfop TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transp_compras_chave_produto
  ON public.transp_compras (empresa_id, chave_nfe, produto_descricao)
  WHERE chave_nfe IS NOT NULL;
