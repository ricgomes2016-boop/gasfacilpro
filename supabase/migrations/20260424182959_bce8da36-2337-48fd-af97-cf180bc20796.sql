ALTER TABLE public.funcionarios 
ADD COLUMN IF NOT EXISTS data_vencimento_ferias_override date;

COMMENT ON COLUMN public.funcionarios.data_vencimento_ferias_override IS 'Data manual para vencimento de férias (sobrescreve cálculo automático baseado em data_admissao)';