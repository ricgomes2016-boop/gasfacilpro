
-- Table to store Z-API WhatsApp credentials per unidade
CREATE TABLE public.integracoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE NOT NULL,
  instance_id TEXT NOT NULL,
  token TEXT NOT NULL,
  security_token TEXT,
  nome_bot TEXT DEFAULT 'Bia',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (unidade_id)
);

-- RLS
ALTER TABLE public.integracoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp configs of their empresa units"
ON public.integracoes_whatsapp FOR SELECT TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "Admins can manage whatsapp configs"
ON public.integracoes_whatsapp FOR ALL TO authenticated
USING (
  public.unidade_belongs_to_user_empresa(unidade_id)
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
)
WITH CHECK (
  public.unidade_belongs_to_user_empresa(unidade_id)
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);
