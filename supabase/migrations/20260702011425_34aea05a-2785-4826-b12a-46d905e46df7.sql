
DO $$
DECLARE
  v_unidade uuid := '3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05'; -- Forte Gás
  v_empresa uuid := 'f27e158e-7ab5-4617-9f66-c6b4a084d293'; -- Central Gas
  v_entregador uuid := '46d43489-fea1-42ab-a42e-4c7da534c9b8'; -- Marcos Antônio (Forte Gás)
  v_prod_gas uuid := 'ac2682cf-e23e-42d7-b562-ba543d099f1b';
  v_prod_agua uuid := 'a8896004-df01-42c2-b6e2-a8408e44039f';
  v_obs_base text := 'Lançado pelo entregador via WhatsApp - Marcos (43988045994)';
  v_cli uuid;
  v_ped uuid;
BEGIN
  -- 1) GARAGEM DA PREFEITURA (cliente existente)
  v_cli := 'e2544d0f-52e6-40f7-8b41-52cfa846159e';
  INSERT INTO pedidos (cliente_id, valor_total, forma_pagamento, status, canal_venda, origem_pedido,
                       endereco_entrega, observacoes, unidade_id, entregador_id)
  VALUES (v_cli, 120.00, 'dinheiro', 'em_rota', 'whatsapp', 'whatsapp_entregador',
          'RUA MICHEL FEREZ HADDAD', v_obs_base || ' — Garagem da Prefeitura', v_unidade, v_entregador)
  RETURNING id INTO v_ped;
  INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
  VALUES (v_ped, v_prod_gas, 1, 120.00);

  -- 2) ANGÉLICA BOLOS (novo)
  INSERT INTO clientes (nome, empresa_id) VALUES ('Angélica Bolos', v_empresa) RETURNING id INTO v_cli;
  INSERT INTO cliente_unidades (cliente_id, unidade_id) VALUES (v_cli, v_unidade);
  INSERT INTO pedidos (cliente_id, valor_total, forma_pagamento, status, canal_venda, origem_pedido,
                       observacoes, unidade_id, entregador_id)
  VALUES (v_cli, 105.00, 'pix', 'em_rota', 'whatsapp', 'whatsapp_entregador',
          v_obs_base || ' — Angélica Bolos', v_unidade, v_entregador)
  RETURNING id INTO v_ped;
  INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
  VALUES (v_ped, v_prod_gas, 1, 105.00);

  -- 3) ANA CLÁUDIA - Rua Francisco Bayardo Lacerda, 23 (novo)
  INSERT INTO clientes (nome, endereco, numero, empresa_id)
  VALUES ('Ana Cláudia', 'RUA FRANCISCO BAYARDO LACERDA', '23', v_empresa)
  RETURNING id INTO v_cli;
  INSERT INTO cliente_unidades (cliente_id, unidade_id) VALUES (v_cli, v_unidade);
  INSERT INTO pedidos (cliente_id, valor_total, forma_pagamento, status, canal_venda, origem_pedido,
                       endereco_entrega, numero_entrega, observacoes, unidade_id, entregador_id)
  VALUES (v_cli, 105.00, 'fiado', 'em_rota', 'whatsapp', 'whatsapp_entregador',
          'RUA FRANCISCO BAYARDO LACERDA', '23',
          v_obs_base || ' — Ana Cláudia (Rua Francisco Bayardo Lacerda, 23)', v_unidade, v_entregador)
  RETURNING id INTO v_ped;
  INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
  VALUES (v_ped, v_prod_gas, 1, 105.00);

  -- 4) TABACARIA BUS (novo)
  INSERT INTO clientes (nome, empresa_id) VALUES ('Tabacaria Bus', v_empresa) RETURNING id INTO v_cli;
  INSERT INTO cliente_unidades (cliente_id, unidade_id) VALUES (v_cli, v_unidade);
  INSERT INTO pedidos (cliente_id, valor_total, forma_pagamento, status, canal_venda, origem_pedido,
                       observacoes, unidade_id, entregador_id)
  VALUES (v_cli, 30.00, 'pix', 'em_rota', 'whatsapp', 'whatsapp_entregador',
          v_obs_base || ' — Tabacaria Bus (2× Água 20L a R$ 15,00)', v_unidade, v_entregador)
  RETURNING id INTO v_ped;
  INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
  VALUES (v_ped, v_prod_agua, 2, 15.00);
END $$;
