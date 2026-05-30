GRANT SELECT (
  id, nome, tipo, telefone, email, endereco, bairro, cidade, estado, cep,
  ativo, created_at, updated_at, latitude, longitude, chave_pix, empresa_id,
  bairros_atendidos, horario_abertura, horario_fechamento
) ON public.unidades TO anon;

GRANT SELECT (
  id, unidade_id, ativo, nome_bot, numero_telefone,
  loja_foto_url, loja_foto_atualizada_em
) ON public.integracoes_whatsapp TO anon;

GRANT SELECT (
  id, nome, tipo, telefone, email, endereco, bairro, cidade, estado, cep,
  ativo, created_at, updated_at, latitude, longitude, chave_pix, empresa_id,
  bairros_atendidos, horario_abertura, horario_fechamento
) ON public.unidades TO authenticated;

GRANT SELECT (
  id, unidade_id, ativo, nome_bot, numero_telefone,
  loja_foto_url, loja_foto_atualizada_em
) ON public.integracoes_whatsapp TO authenticated;