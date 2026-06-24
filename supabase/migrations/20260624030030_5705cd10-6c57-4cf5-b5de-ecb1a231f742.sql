ALTER TABLE public.entregadores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entregadores;