
ALTER TABLE public.rotas_definidas ADD COLUMN tipo text NOT NULL DEFAULT 'cidade';
ALTER TABLE public.rotas_definidas ADD COLUMN cidades jsonb DEFAULT '[]';
