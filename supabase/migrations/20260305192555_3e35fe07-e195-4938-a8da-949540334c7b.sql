ALTER TABLE public.produtos 
  ADD COLUMN IF NOT EXISTS preco_portaria numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preco_telefone numeric DEFAULT NULL;