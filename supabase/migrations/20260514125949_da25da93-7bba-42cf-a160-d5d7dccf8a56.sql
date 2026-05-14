-- 1. Backfill: remove prefixo "WhatsApp:" dos títulos antigos
UPDATE public.ai_conversas
SET titulo = TRIM(regexp_replace(titulo, '^WhatsApp:\s*', ''))
WHERE titulo LIKE 'WhatsApp:%';

-- 2. Permitir admin/gestor/operacional da mesma empresa apagar conversas
DROP POLICY IF EXISTS "Operadores apagam conversas da empresa" ON public.ai_conversas;
CREATE POLICY "Operadores apagam conversas da empresa"
ON public.ai_conversas
FOR DELETE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);