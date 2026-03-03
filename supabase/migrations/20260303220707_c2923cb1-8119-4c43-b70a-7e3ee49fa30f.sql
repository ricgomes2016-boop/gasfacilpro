ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS horario_abertura TEXT DEFAULT '07:00';
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS horario_fechamento TEXT DEFAULT '18:00';