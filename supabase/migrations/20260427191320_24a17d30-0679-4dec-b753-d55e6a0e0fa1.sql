CREATE TABLE IF NOT EXISTS public.rh_avisos_entregador_leituras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aviso_id uuid NOT NULL REFERENCES public.rh_avisos_entregador(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  lido_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, entregador_id)
);

CREATE INDEX IF NOT EXISTS idx_rh_avisos_leituras_entregador ON public.rh_avisos_entregador_leituras(entregador_id, aviso_id);
CREATE INDEX IF NOT EXISTS idx_rh_avisos_leituras_aviso ON public.rh_avisos_entregador_leituras(aviso_id);

ALTER TABLE public.rh_avisos_entregador_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entregadores can view own aviso readings" ON public.rh_avisos_entregador_leituras;
CREATE POLICY "Entregadores can view own aviso readings"
ON public.rh_avisos_entregador_leituras
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.entregadores e
    WHERE e.id = rh_avisos_entregador_leituras.entregador_id
      AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Entregadores can insert own aviso readings" ON public.rh_avisos_entregador_leituras;
CREATE POLICY "Entregadores can insert own aviso readings"
ON public.rh_avisos_entregador_leituras
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.entregadores e
    JOIN public.rh_avisos_entregador a ON a.id = rh_avisos_entregador_leituras.aviso_id
    LEFT JOIN public.unidades u ON u.id = e.unidade_id
    WHERE e.id = rh_avisos_entregador_leituras.entregador_id
      AND e.user_id = auth.uid()
      AND e.ativo = true
      AND a.ativo = true
      AND a.exibir_de <= CURRENT_DATE
      AND (a.exibir_ate IS NULL OR a.exibir_ate >= CURRENT_DATE)
      AND u.empresa_id = a.empresa_id
      AND (a.unidade_id IS NULL OR a.unidade_id = e.unidade_id)
  )
);

DROP POLICY IF EXISTS "Staff can view aviso readings own empresa" ON public.rh_avisos_entregador_leituras;
CREATE POLICY "Staff can view aviso readings own empresa"
ON public.rh_avisos_entregador_leituras
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.rh_avisos_entregador a
    WHERE a.id = rh_avisos_entregador_leituras.aviso_id
      AND a.empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'gestor'::app_role)
      )
  )
);