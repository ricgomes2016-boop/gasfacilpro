DELETE FROM public.cliente_unidades cu
WHERE cu.unidade_id = '07f9bfac-ed8c-4b85-bb06-4b7bc35a1ea3'
  AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cu.cliente_id);