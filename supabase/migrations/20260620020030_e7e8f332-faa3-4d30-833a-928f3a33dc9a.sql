ALTER TABLE public.unidades 
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cor_primaria text;

CREATE UNIQUE INDEX IF NOT EXISTS unidades_slug_unique ON public.unidades (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_unidade_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  nome text,
  slug text,
  logo_url text,
  cor_primaria text,
  empresa_id uuid,
  empresa_nome text,
  empresa_slug text,
  empresa_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nome, u.slug, u.logo_url, u.cor_primaria,
         e.id, e.nome, e.slug, e.logo_url
  FROM public.unidades u
  JOIN public.empresas e ON e.id = u.empresa_id
  WHERE u.slug = _slug
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_unidade_by_slug(text) TO anon, authenticated;