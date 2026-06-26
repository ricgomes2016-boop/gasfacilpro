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

CREATE POLICY "Usuarios gerenciam chaves pix da propria empresa"
  ON public.contas_pix_chaves
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.contas_bancarias cb
      WHERE cb.id = contas_pix_chaves.conta_bancaria_id
        AND cb.unidade_id IS NOT NULL
        AND public.unidade_belongs_to_user_empresa(cb.unidade_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.contas_bancarias cb
      WHERE cb.id = contas_pix_chaves.conta_bancaria_id
        AND cb.unidade_id IS NOT NULL
        AND public.unidade_belongs_to_user_empresa(cb.unidade_id)
        AND (
          contas_pix_chaves.unidade_id IS NULL
          OR contas_pix_chaves.unidade_id = cb.unidade_id
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_contas_pix_chaves_conta ON public.contas_pix_chaves(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_contas_pix_chaves_unidade ON public.contas_pix_chaves(unidade_id);
