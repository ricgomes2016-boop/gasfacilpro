
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS vendedor_id UUID,
  ADD COLUMN IF NOT EXISTS tipo_venda TEXT;

CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_id ON public.pedidos(vendedor_id);

CREATE TABLE IF NOT EXISTS public.vendedor_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID,
  unidade_id UUID,
  meta_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_metas TO authenticated;
GRANT ALL ON public.vendedor_metas TO service_role;

ALTER TABLE public.vendedor_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendedor lê própria meta" ON public.vendedor_metas;
CREATE POLICY "Vendedor lê própria meta" ON public.vendedor_metas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "Admins gerenciam metas vendedor" ON public.vendedor_metas;
CREATE POLICY "Admins gerenciam metas vendedor" ON public.vendedor_metas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role));

DROP TRIGGER IF EXISTS trg_vendedor_metas_updated_at ON public.vendedor_metas;
CREATE TRIGGER trg_vendedor_metas_updated_at
  BEFORE UPDATE ON public.vendedor_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
