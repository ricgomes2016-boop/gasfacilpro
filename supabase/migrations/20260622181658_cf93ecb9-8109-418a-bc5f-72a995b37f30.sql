CREATE TABLE IF NOT EXISTS public.contas_pix_chaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('cpf','cnpj','email','telefone','aleatoria')),
  chave text NOT NULL,
  unidade_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pix_chaves TO authenticated;
GRANT ALL ON public.contas_pix_chaves TO service_role;

ALTER TABLE public.contas_pix_chaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados gerenciam chaves pix"
  ON public.contas_pix_chaves
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contas_pix_chaves_conta ON public.contas_pix_chaves(conta_bancaria_id);