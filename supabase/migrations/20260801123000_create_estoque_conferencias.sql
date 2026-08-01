CREATE TABLE IF NOT EXISTS public.estoque_conferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_conferencia date NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  produto_grupo text NOT NULL CHECK (produto_grupo IN ('P13', 'P20', 'P45', 'Agua')),
  tipo_estoque text NOT NULL CHECK (tipo_estoque IN ('cheio', 'vazio')),
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  conferido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_conferencia, unidade_id, produto_grupo, tipo_estoque)
);

CREATE INDEX IF NOT EXISTS idx_estoque_conferencias_data
  ON public.estoque_conferencias(data_conferencia);

CREATE INDEX IF NOT EXISTS idx_estoque_conferencias_unidade_data
  ON public.estoque_conferencias(unidade_id, data_conferencia);

ALTER TABLE public.estoque_conferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver conferencias da empresa" ON public.estoque_conferencias;
CREATE POLICY "Usuarios podem ver conferencias da empresa"
ON public.estoque_conferencias
FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = estoque_conferencias.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'operacional'::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.user_unidades uu
          WHERE uu.user_id = auth.uid()
            AND uu.unidade_id = u.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Usuarios podem salvar conferencias da empresa" ON public.estoque_conferencias;
CREATE POLICY "Usuarios podem salvar conferencias da empresa"
ON public.estoque_conferencias
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = estoque_conferencias.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'operacional'::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.user_unidades uu
          WHERE uu.user_id = auth.uid()
            AND uu.unidade_id = u.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Usuarios podem atualizar conferencias da empresa" ON public.estoque_conferencias;
CREATE POLICY "Usuarios podem atualizar conferencias da empresa"
ON public.estoque_conferencias
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = estoque_conferencias.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'operacional'::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.user_unidades uu
          WHERE uu.user_id = auth.uid()
            AND uu.unidade_id = u.id
        )
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = estoque_conferencias.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'gestor'::public.app_role)
        OR public.has_role(auth.uid(), 'operacional'::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.user_unidades uu
          WHERE uu.user_id = auth.uid()
            AND uu.unidade_id = u.id
        )
      )
  )
);

DROP TRIGGER IF EXISTS update_estoque_conferencias_updated_at ON public.estoque_conferencias;
CREATE TRIGGER update_estoque_conferencias_updated_at
BEFORE UPDATE ON public.estoque_conferencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
