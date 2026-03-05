
-- Table for competitor price records, isolated by empresa + unidade
CREATE TABLE public.concorrente_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  concorrente_id UUID REFERENCES public.concorrentes(id) ON DELETE CASCADE,
  concorrente_nome TEXT NOT NULL,
  produto TEXT NOT NULL,
  preco NUMERIC(12,2) NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'Visita',
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.concorrente_precos ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see prices from their own empresa
CREATE POLICY "concorrente_precos_select" ON public.concorrente_precos
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "concorrente_precos_insert" ON public.concorrente_precos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "concorrente_precos_delete" ON public.concorrente_precos
  FOR DELETE TO authenticated
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
