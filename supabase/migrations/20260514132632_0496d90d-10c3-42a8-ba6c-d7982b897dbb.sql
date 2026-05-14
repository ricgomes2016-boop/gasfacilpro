
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS nre text,
  ADD COLUMN IF NOT EXISTS estabelecimento text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS validade_inicio date;
