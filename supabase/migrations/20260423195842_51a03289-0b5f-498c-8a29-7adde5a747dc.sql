
-- 1) funcionarios: novos campos
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS tipo_vinculo text NOT NULL DEFAULT 'clt',
  ADD COLUMN IF NOT EXISTS regime_pagamento text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS valor_diaria numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_por_produto jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS entra_na_escala boolean NOT NULL DEFAULT false;

ALTER TABLE public.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_tipo_vinculo_check;
ALTER TABLE public.funcionarios
  ADD CONSTRAINT funcionarios_tipo_vinculo_check
  CHECK (tipo_vinculo IN ('clt','terceirizado','freelancer','pj'));

ALTER TABLE public.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_regime_pagamento_check;
ALTER TABLE public.funcionarios
  ADD CONSTRAINT funcionarios_regime_pagamento_check
  CHECK (regime_pagamento IN ('mensal','diaria','por_produto','misto'));

-- 2) escalas_entregador: permitir associar funcionario
ALTER TABLE public.escalas_entregador
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE CASCADE;

ALTER TABLE public.escalas_entregador
  DROP CONSTRAINT IF EXISTS escalas_pessoa_presente_check;
ALTER TABLE public.escalas_entregador
  ADD CONSTRAINT escalas_pessoa_presente_check
  CHECK (entregador_id IS NOT NULL OR funcionario_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_escalas_funcionario ON public.escalas_entregador(funcionario_id);

-- 3) funcionario_diarias
CREATE TABLE IF NOT EXISTS public.funcionario_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','cancelada')),
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, data)
);

CREATE INDEX IF NOT EXISTS idx_funcionario_diarias_func ON public.funcionario_diarias(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_funcionario_diarias_data ON public.funcionario_diarias(data);
CREATE INDEX IF NOT EXISTS idx_funcionario_diarias_unidade ON public.funcionario_diarias(unidade_id);

ALTER TABLE public.funcionario_diarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diarias select empresa" ON public.funcionario_diarias;
CREATE POLICY "Diarias select empresa" ON public.funcionario_diarias
  FOR SELECT TO authenticated
  USING (
    unidade_id IS NULL
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  );

DROP POLICY IF EXISTS "Diarias insert empresa" ON public.funcionario_diarias;
CREATE POLICY "Diarias insert empresa" ON public.funcionario_diarias
  FOR INSERT TO authenticated
  WITH CHECK (
    unidade_id IS NULL
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  );

DROP POLICY IF EXISTS "Diarias update empresa" ON public.funcionario_diarias;
CREATE POLICY "Diarias update empresa" ON public.funcionario_diarias
  FOR UPDATE TO authenticated
  USING (
    unidade_id IS NULL
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  );

DROP POLICY IF EXISTS "Diarias delete empresa" ON public.funcionario_diarias;
CREATE POLICY "Diarias delete empresa" ON public.funcionario_diarias
  FOR DELETE TO authenticated
  USING (
    unidade_id IS NULL
    OR public.unidade_belongs_to_user_empresa(unidade_id)
  );

DROP TRIGGER IF EXISTS trg_funcionario_diarias_updated ON public.funcionario_diarias;
CREATE TRIGGER trg_funcionario_diarias_updated
  BEFORE UPDATE ON public.funcionario_diarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) comissao_config: regra por funcionário (opcional)
ALTER TABLE public.comissao_config
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE CASCADE;

-- Recriar índice único contemplando o funcionário (NULL = regra geral da unidade)
DROP INDEX IF EXISTS public.comissao_config_unq;
CREATE UNIQUE INDEX IF NOT EXISTS comissao_config_unq
  ON public.comissao_config (
    COALESCE(unidade_id::text, ''),
    COALESCE(funcionario_id::text, ''),
    produto_id,
    lower(canal_venda)
  );

CREATE INDEX IF NOT EXISTS idx_comissao_config_funcionario ON public.comissao_config(funcionario_id);
