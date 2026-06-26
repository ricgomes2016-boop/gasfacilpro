DROP FUNCTION IF EXISTS public.get_empresa_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(_slug text)
RETURNS TABLE(id uuid, nome text, slug text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.nome, e.slug, e.logo_url
  FROM public.empresas e
  WHERE e.slug = _slug
    AND COALESCE(e.ativo, true) = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;
