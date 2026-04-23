ALTER TABLE public.escalas_entregador
ADD COLUMN IF NOT EXISTS almoco_inicio time,
ADD COLUMN IF NOT EXISTS almoco_fim time;