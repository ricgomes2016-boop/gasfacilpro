
-- ============================================================
-- unidades: revoke broad SELECT, regrant only non-sensitive cols
-- ============================================================
REVOKE SELECT ON public.unidades FROM anon, authenticated;

GRANT SELECT (
  id, nome, tipo, cnpj, telefone, email, endereco, bairro, cidade, estado, cep,
  ativo, created_at, updated_at, latitude, longitude, chave_pix, empresa_id,
  bairros_atendidos, horario_abertura, horario_fechamento,
  razao_social, nome_fantasia, inscricao_estadual, inscricao_estadual_st,
  inscricao_municipal, cnae_principal, regime_tributario,
  certificado_a1_path, certificado_a1_validade, certificado_a1_titular,
  nfe_ambiente, nfe_serie, nfe_proximo_numero,
  nfce_serie, nfce_proximo_numero, nfce_csc_id,
  cte_serie, cte_proximo_numero,
  cfop_padrao_venda, cfop_padrao_devolucao, natureza_operacao_padrao,
  aliquota_icms_padrao, aliquota_pis_padrao, aliquota_cofins_padrao, cst_csosn_padrao,
  contador_nome, contador_cpf_cnpj, contador_crc, contador_email, contador_telefone,
  provedor_nfe, provedor_nfe_url
) ON public.unidades TO authenticated;

-- ============================================================
-- integracoes_whatsapp: revoke broad SELECT, regrant safe cols
-- ============================================================
REVOKE SELECT ON public.integracoes_whatsapp FROM anon, authenticated;

GRANT SELECT (
  id, unidade_id, instance_id, nome_bot, ativo, created_at, updated_at,
  desconto_etapa1, desconto_etapa2, preco_minimo_p13, preco_minimo_p20,
  provedor, meta_phone_number_id, base_url, meta_waba_id,
  provedor_tipo, instancia_nome, instancia_url, numero_telefone,
  status_conexao, ultima_verificacao, qr_code_base64, qr_code_expira_em,
  loja_foto_url, loja_foto_atualizada_em
) ON public.integracoes_whatsapp TO authenticated;

-- ============================================================
-- transp_outlook_config: revoke broad SELECT, regrant safe cols
-- ============================================================
REVOKE SELECT ON public.transp_outlook_config FROM anon, authenticated;

GRANT SELECT (
  id, empresa_id, microsoft_user_email, filtro_remetente,
  ultima_importacao, ultimo_status, ultimo_total_importados,
  created_at, updated_at
) ON public.transp_outlook_config TO authenticated;
