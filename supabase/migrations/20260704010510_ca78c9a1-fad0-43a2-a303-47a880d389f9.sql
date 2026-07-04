
CREATE TABLE public.formas_pagamento_custom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT '💰',
  grupo TEXT NOT NULL CHECK (grupo IN ('a_vista','a_prazo')),
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formas_pagamento_custom TO authenticated;
GRANT ALL ON public.formas_pagamento_custom TO service_role;

ALTER TABLE public.formas_pagamento_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem formas da sua unidade"
  ON public.formas_pagamento_custom FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid() AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "Usuarios criam formas na sua unidade"
  ON public.formas_pagamento_custom FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid() AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "Usuarios editam formas da sua unidade"
  ON public.formas_pagamento_custom FOR UPDATE
  TO authenticated
  USING (
    unidade_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid() AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );

CREATE POLICY "Usuarios excluem formas da sua unidade"
  ON public.formas_pagamento_custom FOR DELETE
  TO authenticated
  USING (
    unidade_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid() AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );

CREATE TRIGGER update_formas_pagamento_custom_updated_at
  BEFORE UPDATE ON public.formas_pagamento_custom
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
