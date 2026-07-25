
-- Função: recalcula preco_custo do produto como média ponderada de todas as compras
CREATE OR REPLACE FUNCTION public.recalcular_preco_custo_produto(p_produto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media numeric;
BEGIN
  SELECT CASE
           WHEN SUM(ci.quantidade) > 0
             THEN SUM(ci.quantidade * ci.preco_unitario) / SUM(ci.quantidade)
             ELSE NULL
         END
    INTO v_media
  FROM public.compra_itens ci
  WHERE ci.produto_id = p_produto_id
    AND COALESCE(ci.quantidade, 0) > 0
    AND COALESCE(ci.preco_unitario, 0) > 0;

  IF v_media IS NOT NULL THEN
    UPDATE public.produtos
       SET preco_custo = ROUND(v_media::numeric, 4),
           updated_at = now()
     WHERE id = p_produto_id;
  END IF;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_recalcular_preco_custo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_preco_custo_produto(OLD.produto_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalcular_preco_custo_produto(NEW.produto_id);

  IF TG_OP = 'UPDATE' AND NEW.produto_id IS DISTINCT FROM OLD.produto_id THEN
    PERFORM public.recalcular_preco_custo_produto(OLD.produto_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compra_itens_recalc_custo ON public.compra_itens;
CREATE TRIGGER trg_compra_itens_recalc_custo
AFTER INSERT OR UPDATE OR DELETE ON public.compra_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_preco_custo();

-- Backfill: recalcula agora para todos os produtos com histórico de compras
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT produto_id
      FROM public.compra_itens
     WHERE produto_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_preco_custo_produto(r.produto_id);
  END LOOP;
END $$;
