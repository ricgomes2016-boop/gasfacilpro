ALTER TABLE public.pedidos DISABLE TRIGGER USER;
UPDATE public.pedidos
   SET agendado = true,
       data_entrega = '2026-06-10',
       data_agendamento = '2026-06-10 11:00:00+00'
 WHERE id = '45bd072e-24d7-4a5c-8a8f-0745968d9254';
ALTER TABLE public.pedidos ENABLE TRIGGER USER;