-- Comodato de vasilhames: dois fluxos, devolução parcial e estoque atômico.
ALTER TABLE public.comodatos
  ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'formal',
  ADD COLUMN IF NOT EXISTS quantidade_devolvida integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responsavel_entrega text,
  ADD COLUMN IF NOT EXISTS documento_referencia text,
  ADD COLUMN IF NOT EXISTS local_entrega text,
  ADD COLUMN IF NOT EXISTS finalidade text;

UPDATE public.comodatos SET quantidade_devolvida = quantidade
WHERE status = 'devolvido' AND quantidade_devolvida = 0;

ALTER TABLE public.comodatos
  ADD CONSTRAINT comodatos_modalidade_check CHECK (modalidade IN ('formal', 'rapido')),
  ADD CONSTRAINT comodatos_quantidade_check CHECK (quantidade > 0 AND quantidade_devolvida BETWEEN 0 AND quantidade),
  ADD CONSTRAINT comodatos_status_check CHECK (status IN ('ativo', 'devolvido', 'perdido'));

CREATE OR REPLACE FUNCTION public.fn_comodato_debita_estoque()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_saldo numeric;
BEGIN
  IF NEW.status <> 'ativo' THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.produtos p WHERE p.id = NEW.produto_id
      AND p.unidade_id = NEW.unidade_id AND p.ativo = true AND p.tipo_botijao = 'vazio'
  ) THEN
    RAISE EXCEPTION 'Selecione um vasilhame vazio ativo desta unidade.';
  END IF;
  UPDATE public.produtos SET estoque = estoque - NEW.quantidade
    WHERE id = NEW.produto_id AND unidade_id = NEW.unidade_id AND estoque >= NEW.quantidade
    RETURNING estoque INTO v_saldo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estoque de vasilhames vazios insuficiente.'; END IF;
  INSERT INTO public.movimentacoes_estoque (produto_id, tipo, quantidade, observacoes, unidade_id)
    VALUES (NEW.produto_id, 'saida', NEW.quantidade, 'Comodato ' || NEW.id::text || ' - entrega', NEW.unidade_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trig_comodato_emprestimo ON public.comodatos;
CREATE TRIGGER trig_comodato_emprestimo AFTER INSERT ON public.comodatos
FOR EACH ROW WHEN (NEW.status = 'ativo') EXECUTE FUNCTION public.fn_comodato_debita_estoque();

CREATE OR REPLACE FUNCTION public.fn_comodato_credita_estoque()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_delta integer;
BEGIN
  IF NEW.produto_id IS DISTINCT FROM OLD.produto_id OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
    OR NEW.quantidade IS DISTINCT FROM OLD.quantidade THEN
    RAISE EXCEPTION 'Produto, unidade e quantidade original do comodato não podem ser alterados.';
  END IF;
  v_delta := NEW.quantidade_devolvida - OLD.quantidade_devolvida;
  IF v_delta < 0 THEN RAISE EXCEPTION 'A devolução não pode ser reduzida.'; END IF;
  IF v_delta > 0 THEN
    UPDATE public.produtos SET estoque = estoque + v_delta WHERE id = NEW.produto_id AND unidade_id = NEW.unidade_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto do comodato não encontrado nesta unidade.'; END IF;
    INSERT INTO public.movimentacoes_estoque (produto_id, tipo, quantidade, observacoes, unidade_id)
      VALUES (NEW.produto_id, 'entrada', v_delta, 'Comodato ' || NEW.id::text || ' - devolução', NEW.unidade_id);
  END IF;
  IF NEW.quantidade_devolvida = NEW.quantidade THEN
    NEW.status := 'devolvido';
    NEW.data_devolucao := COALESCE(NEW.data_devolucao, current_date);
  ELSIF NEW.status = 'devolvido' THEN
    RAISE EXCEPTION 'A devolução total exige todos os vasilhames.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trig_comodato_devolucao ON public.comodatos;
CREATE TRIGGER trig_comodato_devolucao BEFORE UPDATE ON public.comodatos
FOR EACH ROW EXECUTE FUNCTION public.fn_comodato_credita_estoque();
