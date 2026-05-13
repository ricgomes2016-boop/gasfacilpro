-- 1) Colunas
ALTER TABLE public.ai_conversas 
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid;

CREATE INDEX IF NOT EXISTS idx_ai_conversas_empresa ON public.ai_conversas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversas_unidade ON public.ai_conversas(unidade_id);

-- 2) Trigger: preenche empresa_id a partir de unidade_id
CREATE OR REPLACE FUNCTION public.fn_ai_conversas_fill_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unidade_id IS NOT NULL AND NEW.empresa_id IS NULL THEN
    SELECT empresa_id INTO NEW.empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_conversas_fill_empresa ON public.ai_conversas;
CREATE TRIGGER trg_ai_conversas_fill_empresa
BEFORE INSERT OR UPDATE ON public.ai_conversas
FOR EACH ROW EXECUTE FUNCTION public.fn_ai_conversas_fill_empresa();

-- 3) Backfill via clientes (best-effort por telefone normalizado)
UPDATE public.ai_conversas a
SET empresa_id = c.empresa_id
FROM public.clientes c
WHERE a.empresa_id IS NULL
  AND a.telefone IS NOT NULL
  AND c.telefone IS NOT NULL
  AND c.empresa_id IS NOT NULL
  AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(a.telefone, '\D', '', 'g');

-- 4) Drop policies antigas e recria com filtro de empresa
DROP POLICY IF EXISTS "Operadores criam conversas WhatsApp da plataforma" ON public.ai_conversas;
DROP POLICY IF EXISTS "Operadores veem conversas WhatsApp da plataforma" ON public.ai_conversas;
DROP POLICY IF EXISTS "Operadores atualizam conversas WhatsApp da plataforma" ON public.ai_conversas;
DROP POLICY IF EXISTS "tenant_isolation_ai_conversas" ON public.ai_conversas;

CREATE POLICY "Operadores veem conversas WhatsApp da empresa"
ON public.ai_conversas FOR SELECT TO authenticated
USING (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND empresa_id IS NOT NULL
  AND empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);

CREATE POLICY "Operadores criam conversas WhatsApp da empresa"
ON public.ai_conversas FOR INSERT TO authenticated
WITH CHECK (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND empresa_id IS NOT NULL
  AND empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);

CREATE POLICY "Operadores atualizam conversas WhatsApp da empresa"
ON public.ai_conversas FOR UPDATE TO authenticated
USING (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND empresa_id IS NOT NULL
  AND empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
)
WITH CHECK (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND empresa_id IS NOT NULL
  AND empresa_id = public.get_user_empresa_id()
);

-- Restritiva: garante isolamento de tenant
CREATE POLICY "tenant_isolation_ai_conversas"
ON public.ai_conversas
AS RESTRICTIVE
FOR ALL
TO public
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR user_id = auth.uid()
  OR (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa_id()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR user_id = auth.uid()
  OR (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa_id()
  )
);