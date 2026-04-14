
ALTER TABLE public.transp_rota_paradas
  ADD COLUMN impacto_estoque text NOT NULL DEFAULT 'nenhum',
  ADD COLUMN impacto_financeiro boolean NOT NULL DEFAULT false,
  ADD COLUMN entidade_id uuid,
  ADD COLUMN entidade_tipo text,
  ADD COLUMN entidade_nome text;

COMMENT ON COLUMN public.transp_rota_paradas.impacto_estoque IS 'entrada | saida | nenhum';
COMMENT ON COLUMN public.transp_rota_paradas.entidade_tipo IS 'distribuidora | unidade | cliente';
