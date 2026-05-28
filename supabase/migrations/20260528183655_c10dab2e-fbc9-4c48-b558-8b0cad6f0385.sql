ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS foto_painel text,
  ADD COLUMN IF NOT EXISTS foto_frente text,
  ADD COLUMN IF NOT EXISTS foto_lado_direito text,
  ADD COLUMN IF NOT EXISTS foto_lado_esquerdo text,
  ADD COLUMN IF NOT EXISTS foto_traseira text;