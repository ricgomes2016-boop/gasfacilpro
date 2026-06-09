ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS lembrete_enviado_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_pedidos_agendamento_lembrete
  ON public.pedidos (data_agendamento)
  WHERE agendado = true AND lembrete_enviado_em IS NULL;