ALTER TABLE public.operadoras_cartao ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.terminais_cartao ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS conta_bancaria_destino_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_operadoras_cartao_conta_bancaria_id ON public.operadoras_cartao(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_terminais_cartao_conta_bancaria_id ON public.terminais_cartao(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_conta_bancaria_destino_id ON public.contas_receber(conta_bancaria_destino_id);