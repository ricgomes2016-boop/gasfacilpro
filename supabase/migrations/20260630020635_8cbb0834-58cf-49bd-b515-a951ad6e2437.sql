
-- Adiciona valor de enum para origem de pedido lançado pelo entregador via WhatsApp
ALTER TYPE origem_pedido_enum ADD VALUE IF NOT EXISTS 'whatsapp_entregador';

-- Tabela de rascunhos para lançamentos por entregador via WhatsApp
CREATE TABLE IF NOT EXISTS public.entregador_lancamento_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  entregador_id uuid NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entreg_draft_tel ON public.entregador_lancamento_drafts(telefone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregador_lancamento_drafts TO authenticated;
GRANT ALL ON public.entregador_lancamento_drafts TO service_role;

ALTER TABLE public.entregador_lancamento_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role gere drafts" ON public.entregador_lancamento_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Entregador vê seus próprios drafts" ON public.entregador_lancamento_drafts
  FOR SELECT TO authenticated USING (
    entregador_id IN (SELECT id FROM public.entregadores WHERE user_id = auth.uid())
  );
