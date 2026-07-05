
-- 1) Rename cadastro
UPDATE public.canais_venda SET nome = 'Disk/Telefone' WHERE btrim(nome) = 'Disk/ Telefone' OR btrim(nome) = 'Disk/Telefone' AND nome <> 'Disk/Telefone';

-- 2) Trim geral no cadastro
UPDATE public.canais_venda SET nome = btrim(nome) WHERE nome <> btrim(nome);

-- 3) Pedidos: consolidar variantes e nulos
UPDATE public.pedidos SET canal_venda = 'Disk/Telefone'
 WHERE canal_venda IS NULL
    OR btrim(canal_venda) = ''
    OR btrim(canal_venda) = 'Disk/ Telefone'
    OR btrim(canal_venda) = 'Disk/Telefone';

UPDATE public.pedidos SET canal_venda = btrim(canal_venda)
 WHERE canal_venda IS NOT NULL AND canal_venda <> btrim(canal_venda);

-- 4) Índice único case-insensitive por unidade
CREATE UNIQUE INDEX IF NOT EXISTS canais_venda_nome_unidade_uniq
  ON public.canais_venda (unidade_id, lower(btrim(nome)))
  WHERE unidade_id IS NOT NULL;

-- 5) Trigger de normalização em canais_venda
CREATE OR REPLACE FUNCTION public.normalizar_canal_venda_nome()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.nome IS NOT NULL THEN
    NEW.nome := btrim(NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_canal_venda_nome ON public.canais_venda;
CREATE TRIGGER trg_normalizar_canal_venda_nome
  BEFORE INSERT OR UPDATE ON public.canais_venda
  FOR EACH ROW EXECUTE FUNCTION public.normalizar_canal_venda_nome();

-- 6) Trigger de normalização em pedidos.canal_venda
CREATE OR REPLACE FUNCTION public.normalizar_pedido_canal_venda()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.canal_venda IS NOT NULL THEN
    NEW.canal_venda := NULLIF(btrim(NEW.canal_venda), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_pedido_canal_venda ON public.pedidos;
CREATE TRIGGER trg_normalizar_pedido_canal_venda
  BEFORE INSERT OR UPDATE OF canal_venda ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.normalizar_pedido_canal_venda();
