DROP INDEX IF EXISTS public.idx_empenhos_empresa_numero;
CREATE UNIQUE INDEX idx_empenhos_empresa_numero_produto ON public.empenhos (empresa_id, numero_empenho, produto_id);