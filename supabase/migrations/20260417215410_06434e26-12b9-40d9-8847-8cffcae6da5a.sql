-- Remover duplicatas de clientes na Forte Gás criadas pela importação
-- Mantém o registro mais antigo (menor created_at) para cada combinação (nome, telefone)
WITH duplicados AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, nome, COALESCE(telefone, '')
      ORDER BY created_at ASC
    ) AS rn
  FROM public.clientes
  WHERE empresa_id = 'c94c210b-8dbd-4d91-914e-2db146b8cf94'
)
DELETE FROM public.clientes
WHERE id IN (SELECT id FROM duplicados WHERE rn > 1);