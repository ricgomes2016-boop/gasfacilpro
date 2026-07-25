
CREATE TABLE public.ro_ajustes_mensais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  representante TEXT,
  chave TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, ano, mes, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ro_ajustes_mensais TO authenticated;
GRANT ALL ON public.ro_ajustes_mensais TO service_role;

ALTER TABLE public.ro_ajustes_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ro_ajustes_select_by_unidade"
ON public.ro_ajustes_mensais FOR SELECT TO authenticated
USING (
  unidade_id IN (SELECT uu.unidade_id FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "ro_ajustes_insert_by_unidade"
ON public.ro_ajustes_mensais FOR INSERT TO authenticated
WITH CHECK (
  unidade_id IN (SELECT uu.unidade_id FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "ro_ajustes_update_by_unidade"
ON public.ro_ajustes_mensais FOR UPDATE TO authenticated
USING (
  unidade_id IN (SELECT uu.unidade_id FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  unidade_id IN (SELECT uu.unidade_id FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "ro_ajustes_delete_by_unidade"
ON public.ro_ajustes_mensais FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_ro_ajustes_updated_at
BEFORE UPDATE ON public.ro_ajustes_mensais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ro_ajustes_unid_periodo ON public.ro_ajustes_mensais(unidade_id, ano, mes);
