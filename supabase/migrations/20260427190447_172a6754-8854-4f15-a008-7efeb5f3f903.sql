CREATE TABLE IF NOT EXISTS public.rh_avisos_entregador (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  prioridade text NOT NULL DEFAULT 'normal',
  ativo boolean NOT NULL DEFAULT true,
  fixado boolean NOT NULL DEFAULT false,
  exibir_de date NOT NULL DEFAULT CURRENT_DATE,
  exibir_ate date,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_avisos_empresa_status ON public.rh_avisos_entregador(empresa_id, ativo, exibir_de, exibir_ate);
CREATE INDEX IF NOT EXISTS idx_rh_avisos_unidade ON public.rh_avisos_entregador(unidade_id);
CREATE INDEX IF NOT EXISTS idx_rh_avisos_fixado ON public.rh_avisos_entregador(empresa_id, fixado, created_at DESC);

ALTER TABLE public.rh_avisos_entregador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own empresa RH avisos" ON public.rh_avisos_entregador;
CREATE POLICY "Staff can view own empresa RH avisos"
ON public.rh_avisos_entregador
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "Staff can insert own empresa RH avisos" ON public.rh_avisos_entregador;
CREATE POLICY "Staff can insert own empresa RH avisos"
ON public.rh_avisos_entregador
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = public.get_user_empresa_id()
  AND (
    unidade_id IS NULL
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
);

DROP POLICY IF EXISTS "Staff can update own empresa RH avisos" ON public.rh_avisos_entregador;
CREATE POLICY "Staff can update own empresa RH avisos"
ON public.rh_avisos_entregador
FOR UPDATE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id()
  AND (
    unidade_id IS NULL
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
);

DROP POLICY IF EXISTS "Staff can delete own empresa RH avisos" ON public.rh_avisos_entregador;
CREATE POLICY "Staff can delete own empresa RH avisos"
ON public.rh_avisos_entregador
FOR DELETE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
);

DROP POLICY IF EXISTS "Entregadores can view active RH avisos" ON public.rh_avisos_entregador;
CREATE POLICY "Entregadores can view active RH avisos"
ON public.rh_avisos_entregador
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND exibir_de <= CURRENT_DATE
  AND (exibir_ate IS NULL OR exibir_ate >= CURRENT_DATE)
  AND EXISTS (
    SELECT 1
    FROM public.entregadores e
    LEFT JOIN public.unidades u ON u.id = e.unidade_id
    WHERE e.user_id = auth.uid()
      AND e.ativo = true
      AND u.empresa_id = rh_avisos_entregador.empresa_id
      AND (
        rh_avisos_entregador.unidade_id IS NULL
        OR rh_avisos_entregador.unidade_id = e.unidade_id
      )
  )
);

DROP TRIGGER IF EXISTS update_rh_avisos_entregador_updated_at ON public.rh_avisos_entregador;
CREATE TRIGGER update_rh_avisos_entregador_updated_at
BEFORE UPDATE ON public.rh_avisos_entregador
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();