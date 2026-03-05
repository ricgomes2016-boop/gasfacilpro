CREATE TABLE public.concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  nivel_ameaca TEXT NOT NULL DEFAULT 'moderado',
  produtos_precos JSONB DEFAULT '[]'::jsonb,
  observacoes TEXT,
  telefone TEXT,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.concorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view concorrentes of their empresa" ON public.concorrentes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert concorrentes for their empresa" ON public.concorrentes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update concorrentes of their empresa" ON public.concorrentes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete concorrentes of their empresa" ON public.concorrentes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER update_concorrentes_updated_at
  BEFORE UPDATE ON public.concorrentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();