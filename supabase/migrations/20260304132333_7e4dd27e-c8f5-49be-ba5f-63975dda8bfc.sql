ALTER TABLE public.integracoes_whatsapp 
  ADD COLUMN desconto_etapa1 numeric DEFAULT 5.00,
  ADD COLUMN desconto_etapa2 numeric DEFAULT 10.00,
  ADD COLUMN preco_minimo_p13 numeric DEFAULT NULL,
  ADD COLUMN preco_minimo_p20 numeric DEFAULT NULL;