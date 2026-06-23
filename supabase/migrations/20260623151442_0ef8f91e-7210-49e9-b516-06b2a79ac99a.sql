-- Enum for pedido origem
DO $$ BEGIN
  CREATE TYPE public.origem_pedido_enum AS ENUM (
    'telefone_ia','erp','whatsapp','site','app_entregador','app_cliente',
    'portal_parceiro','balcao_pdv','telefone','portaria','assistente_bia','autoatendimento'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS origem_pedido public.origem_pedido_enum;

-- Backfill from current canal_venda
UPDATE public.pedidos SET origem_pedido = CASE
  WHEN canal_venda ILIKE 'telefone_ia' OR canal_venda ILIKE 'telefone' THEN 'telefone_ia'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'whatsapp' THEN 'whatsapp'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'site_ia' OR canal_venda ILIKE 'site' THEN 'site'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'aplicativo' OR canal_venda ILIKE 'app_cliente' THEN 'app_cliente'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'entregador' OR canal_venda ILIKE 'app_entregador' THEN 'app_entregador'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'portaria' THEN 'portaria'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'assistente' OR canal_venda ILIKE 'assistente_bia' OR canal_venda ILIKE 'bia' THEN 'assistente_bia'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'autoatendimento' THEN 'autoatendimento'::public.origem_pedido_enum
  WHEN canal_venda ILIKE 'pdv' OR canal_venda ILIKE 'balcao' OR canal_venda ILIKE 'balcao_pdv' OR canal_venda ILIKE 'ponto de venda' THEN 'balcao_pdv'::public.origem_pedido_enum
  ELSE 'erp'::public.origem_pedido_enum
END
WHERE origem_pedido IS NULL;

-- Default for new rows
ALTER TABLE public.pedidos
  ALTER COLUMN origem_pedido SET DEFAULT 'erp'::public.origem_pedido_enum;

UPDATE public.pedidos SET origem_pedido = 'erp' WHERE origem_pedido IS NULL;
ALTER TABLE public.pedidos ALTER COLUMN origem_pedido SET NOT NULL;
