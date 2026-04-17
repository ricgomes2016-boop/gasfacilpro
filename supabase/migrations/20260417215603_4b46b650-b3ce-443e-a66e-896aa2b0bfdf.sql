WITH duplicados AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, nome, COALESCE(telefone, '')
      ORDER BY created_at ASC
    ) AS rn
  FROM public.clientes
  WHERE empresa_id = 'c94c210b-8dbd-4d91-914e-2db146b8cf94'
)
DELETE FROM public.clientes WHERE id IN (SELECT id FROM duplicados WHERE rn > 1);

DELETE FROM public.cliente_unidades cu
WHERE cu.unidade_id = '07f9bfac-ed8c-4b85-bb06-4b7bc35a1ea3'
  AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cu.cliente_id);