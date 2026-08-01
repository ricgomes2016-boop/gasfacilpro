-- Migra a Bia telefonica para operar corretamente na empresa Forte Gas.
-- Mantem o roteamento multiempresa: Twilio/ElevenLabs resolvem a empresa pelo DID
-- e as tools da Bia usam empresa_id/unidade_id do contexto da ligacao.

ALTER TABLE public.chamadas_recebidas
  ALTER COLUMN telefone DROP NOT NULL;

ALTER TABLE public.chamadas_recebidas
  DROP CONSTRAINT IF EXISTS chamadas_recebidas_status_check;

ALTER TABLE public.chamadas_recebidas
  ADD CONSTRAINT chamadas_recebidas_status_check
  CHECK (status IN ('recebida', 'atendida', 'perdida', 'retornar', 'finalizada', 'concluida', 'erro'));

DO $$
DECLARE
  v_empresa_forte uuid := 'c94c210b-8dbd-4d91-914e-2db146b8cf94';
  v_unidade_forte uuid := '3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05';
  v_regras_base jsonb;
BEGIN
  SELECT regras_bia
    INTO v_regras_base
  FROM public.configuracoes_empresa
  WHERE empresa_id = 'f27e158e-7ab5-4617-9f66-c6b4a084d293'
    AND regras_bia IS NOT NULL
  LIMIT 1;

  v_regras_base := COALESCE(
    v_regras_base,
    '{
      "bia_ativa": true,
      "horario_abertura": "08:00",
      "horario_fechamento": "19:00",
      "horario_domingo_fechamento": "14:00",
      "domingo_ativo": true,
      "agua_entrega_domingo": false,
      "categorias_permitidas": ["gas", "agua", "vasilhame"],
      "mensagem_fora_horario": "Estamos fechados agora, mas posso agendar seu pedido!",
      "desconto_etapa1": 3,
      "desconto_etapa2": 5,
      "preco_minimo_p13": null,
      "preco_minimo_p20": null,
      "gas_do_povo_entrega": false,
      "gas_do_povo_taxa": 15,
      "recompra_ativa": true,
      "recompra_mensagem_personalizada": "",
      "auto_followup_ativo": false,
      "validar_area_entrega": false,
      "relatorio_diario_ativo": false,
      "relatorio_diario_telefone": "",
      "tabela_precos": {
        "gas_p13": { "preco": 125, "preco_desconto": 120 },
        "gas_p20": { "preco": 210, "preco_desconto": 200 },
        "gas_p45": { "preco": 410, "preco_desconto": 400 },
        "agua_20l": { "preco": 20, "preco_desconto": 20 }
      }
    }'::jsonb
  );

  INSERT INTO public.configuracoes_empresa (
    nome_empresa,
    telefone,
    endereco,
    mensagem_cupom,
    empresa_id,
    regras_bia
  )
  SELECT
    e.nome,
    u.telefone,
    u.endereco,
    'Obrigado pela preferencia!',
    e.id,
    v_regras_base
  FROM public.empresas e
  LEFT JOIN public.unidades u ON u.id = v_unidade_forte
  WHERE e.id = v_empresa_forte
  ON CONFLICT (empresa_id) DO UPDATE
  SET
    nome_empresa = EXCLUDED.nome_empresa,
    telefone = COALESCE(public.configuracoes_empresa.telefone, EXCLUDED.telefone),
    endereco = COALESCE(public.configuracoes_empresa.endereco, EXCLUDED.endereco),
    regras_bia = COALESCE(public.configuracoes_empresa.regras_bia, EXCLUDED.regras_bia),
    updated_at = now();

  INSERT INTO public.did_empresa_routing (did, empresa_id, unidade_id, provedor, observacao, ativo)
  VALUES
    ('+554323980020', v_empresa_forte, v_unidade_forte, 'twilio', 'DID operacional Twilio Forte Gas', true),
    ('+554337717463', v_empresa_forte, v_unidade_forte, 'twilio', 'DID Forte Gas legado/encaminhamento', true)
  ON CONFLICT (did) DO UPDATE
  SET
    empresa_id = EXCLUDED.empresa_id,
    unidade_id = EXCLUDED.unidade_id,
    provedor = EXCLUDED.provedor,
    observacao = EXCLUDED.observacao,
    ativo = true,
    updated_at = now();
END $$;
