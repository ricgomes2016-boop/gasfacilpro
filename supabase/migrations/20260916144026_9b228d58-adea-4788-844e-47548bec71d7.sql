REVOKE SELECT ON TABLE public.unidades FROM authenticated;
REVOKE SELECT ON TABLE public.unidades FROM anon;

GRANT SELECT (
  id, nome, tipo, cnpj, telefone, email, endereco, bairro, cidade, estado, cep,
  ativo, created_at, updated_at, latitude, longitude, chave_pix, empresa_id,
  bairros_atendidos, horario_abertura, horario_fechamento, razao_social,
  nome_fantasia, inscricao_estadual, inscricao_estadual_st, inscricao_municipal,
  cnae_principal, regime_tributario, certificado_a1_validade, certificado_a1_titular,
  nfe_ambiente, nfe_serie, nfe_proximo_numero, nfce_serie, nfce_proximo_numero,
  nfce_csc_id, cte_serie, cte_proximo_numero, cfop_padrao_venda, cfop_padrao_devolucao,
  natureza_operacao_padrao, aliquota_icms_padrao, aliquota_pis_padrao,
  aliquota_cofins_padrao, cst_csosn_padrao, contador_nome, contador_crc,
  contador_telefone, provedor_nfe, provedor_nfe_url, gas_do_povo_habilitado,
  gas_do_povo_valor, whatsapp_notificacao_pedido, slug, logo_url, cor_primaria
) ON public.unidades TO authenticated;

GRANT SELECT (
  id, nome, tipo, telefone, email, endereco, bairro, cidade, estado, cep, ativo,
  created_at, updated_at, latitude, longitude, chave_pix, empresa_id,
  bairros_atendidos, horario_abertura, horario_fechamento, gas_do_povo_habilitado,
  gas_do_povo_valor, slug, logo_url, cor_primaria
) ON public.unidades TO anon;