
-- Adiciona campos de pagamento/rota financeira em compras
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS origem_pagamento text,
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caixa_sessao_id uuid REFERENCES public.caixa_sessoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parcelas integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_compras_conta_bancaria_id ON public.compras(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_compras_caixa_sessao_id ON public.compras(caixa_sessao_id);

-- Vínculo reverso para reversão financeira
ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES public.compras(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_compra_id ON public.movimentacoes_caixa(compra_id);

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES public.compras(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_compra_id ON public.contas_pagar(compra_id);

ALTER TABLE public.cheques
  ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES public.compras(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cheques_compra_id ON public.cheques(compra_id);
