-- Remove duplicates: keep highest valor, then most recent
DELETE FROM public.comissao_config a
USING public.comissao_config b
WHERE a.id < b.id
  AND COALESCE(a.unidade_id::text,'') = COALESCE(b.unidade_id::text,'')
  AND a.produto_id = b.produto_id
  AND lower(a.canal_venda) = lower(b.canal_venda);

-- Unique index to prevent future duplicates (case-insensitive on canal)
CREATE UNIQUE INDEX IF NOT EXISTS comissao_config_unq
  ON public.comissao_config (
    COALESCE(unidade_id::text, ''),
    produto_id,
    lower(canal_venda)
  );