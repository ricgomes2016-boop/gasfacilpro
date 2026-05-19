
-- ============ Tabela comprovantes_entrega ============
CREATE TABLE IF NOT EXISTS public.comprovantes_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  entregador_id uuid REFERENCES public.entregadores(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  assinatura_url text,
  foto_url text,
  nome_recebedor text,
  documento_recebedor text,
  observacao text,
  latitude numeric,
  longitude numeric,
  user_agent text,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comprovantes_pedido ON public.comprovantes_entrega(pedido_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_unidade ON public.comprovantes_entrega(unidade_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_empresa ON public.comprovantes_entrega(empresa_id);

ALTER TABLE public.comprovantes_entrega ENABLE ROW LEVEL SECURITY;

-- Trigger pra preencher empresa_id a partir de unidade_id quando faltar
CREATE OR REPLACE FUNCTION public.fn_comprovante_fill_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO NEW.empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_comprovante_fill_empresa ON public.comprovantes_entrega;
CREATE TRIGGER tg_comprovante_fill_empresa
  BEFORE INSERT OR UPDATE ON public.comprovantes_entrega
  FOR EACH ROW EXECUTE FUNCTION public.fn_comprovante_fill_empresa();

-- RLS: gestores/admin da empresa, ou o entregador dono
DROP POLICY IF EXISTS "comprovantes_select" ON public.comprovantes_entrega;
CREATE POLICY "comprovantes_select" ON public.comprovantes_entrega
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.user_belongs_to_empresa(auth.uid(), empresa_id)
    OR EXISTS (
      SELECT 1 FROM public.entregadores e
      WHERE e.id = comprovantes_entrega.entregador_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "comprovantes_insert" ON public.comprovantes_entrega;
CREATE POLICY "comprovantes_insert" ON public.comprovantes_entrega
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.entregadores e
      WHERE e.id = comprovantes_entrega.entregador_id
        AND e.user_id = auth.uid()
    )
    OR public.user_belongs_to_empresa(auth.uid(), empresa_id)
  );

DROP POLICY IF EXISTS "comprovantes_update" ON public.comprovantes_entrega;
CREATE POLICY "comprovantes_update" ON public.comprovantes_entrega
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  );

-- ============ Bucket comprovantes-entrega ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-entrega', 'comprovantes-entrega', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: autenticado lê/escreve, gestor/admin gerencia
DROP POLICY IF EXISTS "comprovantes_storage_select" ON storage.objects;
CREATE POLICY "comprovantes_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes-entrega');

DROP POLICY IF EXISTS "comprovantes_storage_insert" ON storage.objects;
CREATE POLICY "comprovantes_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes-entrega');

DROP POLICY IF EXISTS "comprovantes_storage_update" ON storage.objects;
CREATE POLICY "comprovantes_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'comprovantes-entrega');

DROP POLICY IF EXISTS "comprovantes_storage_delete" ON storage.objects;
CREATE POLICY "comprovantes_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes-entrega'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  );
