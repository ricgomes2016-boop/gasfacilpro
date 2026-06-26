ALTER TABLE public.unidades
ADD COLUMN IF NOT EXISTS bairros_atendidos text;

GRANT SELECT (bairros_atendidos) ON public.unidades TO anon, authenticated;
