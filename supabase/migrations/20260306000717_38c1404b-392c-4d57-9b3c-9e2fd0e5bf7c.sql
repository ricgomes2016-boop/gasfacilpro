
-- Function to seed default products when a new unidade is created
CREATE OR REPLACE FUNCTION public.fn_seed_produtos_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_p13_cheio_id uuid;
  v_p20_cheio_id uuid;
  v_p45_cheio_id uuid;
  v_agua_id uuid;
  v_p13_vazio_id uuid;
  v_p20_vazio_id uuid;
  v_p45_vazio_id uuid;
BEGIN
  -- Gás P13 Cheio
  INSERT INTO public.produtos (nome, preco, categoria, tipo_botijao, estoque, unidade_id, descricao)
  VALUES ('Gás P13', 0, 'gas', 'cheio', 0, NEW.id, 'Botijão de gás 13kg')
  RETURNING id INTO v_p13_cheio_id;

  -- Gás P13 Vazio
  INSERT INTO public.produtos (nome, preco, categoria, tipo_botijao, estoque, unidade_id, descricao)
  VALUES ('Gás P13 Vazio', 0, 'vasilhame', 'vazio', 0, NEW.id, 'Vasilhame vazio P13')
  RETURNING id INTO v_p13_vazio_id;

  -- Link P13 par
  UPDATE public.produtos SET botijao_par_id = v_p13_vazio_id WHERE id = v_p13_cheio_id;
  UPDATE public.produtos SET botijao_par_id = v_p13_cheio_id WHERE id = v_p13_vazio_id;

  -- Gás P20 Cheio
  INSERT INTO public.produtos (nome, preco, categoria, tipo_botijao, estoque, unidade_id, descricao)
  VALUES ('Gás P20', 0, 'gas', 'cheio', 0, NEW.id, 'Botijão de gás 20kg')
  RETURNING id INTO v_p20_cheio_id;

  -- Gás P20 Vazio
  INSERT INTO public.produtos (nome, preco, categoria, tipo_botijao, estoque, unidade_id, descricao)
  VALUES ('Gás P20 Vazio', 0, 'vasilhame', 'vazio', 0, NEW.id, 'Vasilhame vazio P20')
  RETURNING id INTO v_p20_vazio_id;

  UPDATE public.produtos SET botijao_par_id = v_p20_vazio_id WHERE id = v_p20_cheio_id;
  UPDATE public.produtos SET botijao_par_id = v_p20_cheio_id WHERE id = v_p20_vazio_id;

  -- Gás P45 Cheio
  INSERT INTO public.produtos (nome, preco, categoria, tipo_botijao, estoque, unidade_id, descricao)
  VALUES ('Gás P45', 0, 'gas', 'cheio', 0, NEW.id, 'Botijão de gás 45kg')
  RETURNING id INTO v_p45_cheio_id;

  -- Gás P45 Vazio
  INSERT INTO public.produtos (nome, preco, categoria, tipo_botijao, estoque, unidade_id, descricao)
  VALUES ('Gás P45 Vazio', 0, 'vasilhame', 'vazio', 0, NEW.id, 'Vasilhame vazio P45')
  RETURNING id INTO v_p45_vazio_id;

  UPDATE public.produtos SET botijao_par_id = v_p45_vazio_id WHERE id = v_p45_cheio_id;
  UPDATE public.produtos SET botijao_par_id = v_p45_cheio_id WHERE id = v_p45_vazio_id;

  -- Água Mineral 20L
  INSERT INTO public.produtos (nome, preco, categoria, estoque, unidade_id, descricao)
  VALUES ('Água Mineral 20L', 0, 'agua', 0, NEW.id, 'Galão de água mineral 20 litros');

  RETURN NEW;
END;
$$;

-- Trigger: after inserting a new unidade, seed default products
CREATE TRIGGER trg_seed_produtos_padrao
  AFTER INSERT ON public.unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_seed_produtos_padrao();
