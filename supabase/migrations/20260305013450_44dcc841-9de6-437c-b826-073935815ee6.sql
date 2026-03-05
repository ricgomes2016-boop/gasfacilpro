CREATE TABLE public.recompra_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recompra_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dispatches" ON public.recompra_dispatches
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_recompra_dispatches_cliente_date ON public.recompra_dispatches (cliente_id, created_at);