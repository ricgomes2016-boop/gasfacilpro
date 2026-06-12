ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS certificado_a1_path text,
  ADD COLUMN IF NOT EXISTS certificado_a1_senha text,
  ADD COLUMN IF NOT EXISTS certificado_a1_titular text,
  ADD COLUMN IF NOT EXISTS certificado_a1_validade date;

DROP FUNCTION IF EXISTS public.get_unidade_certificado_status(uuid);

CREATE OR REPLACE FUNCTION public.get_unidade_certificado_status(_unidade_id uuid)
RETURNS TABLE(
  certificado_a1_configurado boolean,
  certificado_a1_titular text,
  certificado_a1_validade date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (u.certificado_a1_path IS NOT NULL AND u.certificado_a1_senha IS NOT NULL) AS certificado_a1_configurado,
    u.certificado_a1_titular,
    u.certificado_a1_validade
  FROM public.unidades u
  WHERE u.id = _unidade_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_unidades uu
        WHERE uu.unidade_id = u.id AND uu.user_id = auth.uid()
      )
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_unidade_certificado_status(uuid) TO authenticated;
