/**
 * Service Layer para integração com Focus NFe
 * 
 * Documentação: https://focusnfe.com.br/doc/
 * 
 * Este service abstrai toda a comunicação com a API Focus NFe.
 * Para ativar, configure os secrets FOCUS_NFE_TOKEN e FOCUS_NFE_ENVIRONMENT
 * no Lovable Cloud e implemente a edge function `focus-nfe-proxy`.
 * 
 * Ambiente: homologacao | producao
 */

import { supabase } from "@/integrations/supabase/client";

// Tipos
export type TipoDocumentoFiscal = "nfe" | "nfce" | "cte" | "mdfe";
export type StatusDocumentoFiscal = "rascunho" | "processando" | "autorizada" | "cancelada" | "denegada" | "inutilizada" | "rejeitada";

export interface NotaFiscal {
  id: string;
  tipo: TipoDocumentoFiscal;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  protocolo: string | null;
  status: StatusDocumentoFiscal;
  destinatario_nome: string | null;
  destinatario_cpf_cnpj: string | null;
  destinatario_endereco: string | null;
  destinatario_cidade_uf: string | null;
  destinatario_ie: string | null;
  valor_total: number;
  valor_frete: number;
  natureza_operacao: string | null;
  forma_pagamento: string | null;
  remetente_nome: string | null;
  remetente_cpf_cnpj: string | null;
  modal: string | null;
  peso_bruto: number | null;
  uf_carregamento: string | null;
  uf_descarregamento: string | null;
  motorista_nome: string | null;
  motorista_cpf: string | null;
  placa: string | null;
  rntrc: string | null;
  focus_id: string | null;
  focus_ref: string | null;
  xml_url: string | null;
  danfe_url: string | null;
  motivo_rejeicao: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  carta_correcao: string | null;
  observacoes: string | null;
  data_emissao: string;
  unidade_id: string | null;
  created_at: string;
  updated_at: string;
  // Transport extended
  modalidade_frete: string | null;
  transportadora_nome: string | null;
  transportadora_cnpj: string | null;
  transportadora_ie: string | null;
  transportadora_endereco: string | null;
  transportadora_cidade_uf: string | null;
  peso_liquido: number | null;
  quantidade_volumes: number | null;
  especie_volumes: string | null;
  marca_volumes: string | null;
  numeracao_volumes: string | null;
  uf_placa: string | null;
  info_complementares: string | null;
  info_fisco: string | null;
  xml_importado: boolean;
  xml_conteudo: string | null;
}

export interface NotaFiscalItem {
  id: string;
  nota_fiscal_id: string;
  produto_id: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

// ===== CRUD Local (Supabase) =====

export async function listarNotas(tipo?: TipoDocumentoFiscal, filtros?: {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
}) {
  let query = supabase
    .from("notas_fiscais")
    .select("*")
    .order("data_emissao", { ascending: false });

  if (tipo) query = query.eq("tipo", tipo);
  if (filtros?.status && filtros.status !== "todas") query = query.eq("status", filtros.status);
  if (filtros?.dataInicio) query = query.gte("data_emissao", filtros.dataInicio);
  if (filtros?.dataFim) query = query.lte("data_emissao", filtros.dataFim);
  if (filtros?.busca) {
    query = query.or(`destinatario_nome.ilike.%${filtros.busca}%,numero.ilike.%${filtros.busca}%,chave_acesso.ilike.%${filtros.busca}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as NotaFiscal[];
}

export async function obterNota(id: string) {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as NotaFiscal;
}

export async function criarNota(nota: Partial<NotaFiscal>) {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .insert(nota)
    .select()
    .single();
  if (error) throw error;
  return data as NotaFiscal;
}

export async function atualizarNota(id: string, nota: Partial<NotaFiscal>) {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .update(nota)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as NotaFiscal;
}

export async function excluirNota(id: string) {
  const { error } = await supabase
    .from("notas_fiscais")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ===== Itens =====

export async function listarItens(notaFiscalId: string) {
  const { data, error } = await supabase
    .from("nota_fiscal_itens")
    .select("*")
    .eq("nota_fiscal_id", notaFiscalId)
    .order("created_at");
  if (error) throw error;
  return data as NotaFiscalItem[];
}

export async function adicionarItem(item: Partial<NotaFiscalItem>) {
  const { data, error } = await supabase
    .from("nota_fiscal_itens")
    .insert(item as any)
    .select()
    .single();
  if (error) throw error;
  return data as NotaFiscalItem;
}

export async function removerItem(id: string) {
  const { error } = await supabase
    .from("nota_fiscal_itens")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ===== MDF-e NF-es vinculadas =====

export async function listarNfesVinculadas(mdfeId: string) {
  const { data, error } = await supabase
    .from("mdfe_nfes_vinculadas")
    .select("*")
    .eq("mdfe_id", mdfeId);
  if (error) throw error;
  return data;
}

export async function vincularNfe(mdfeId: string, dados: { chave_acesso: string; destinatario?: string; valor?: number; nfe_id?: string }) {
  const { data, error } = await supabase
    .from("mdfe_nfes_vinculadas")
    .insert({ mdfe_id: mdfeId, ...dados })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== Estatísticas para Dashboard =====

export async function obterEstatisticasFiscais() {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select("tipo, status, valor_total, data_emissao");
  if (error) throw error;
  return data as Pick<NotaFiscal, "tipo" | "status" | "valor_total" | "data_emissao">[];
}

// ===== Focus NFe API (via Edge Function proxy) =====
// Quando a edge function `focus-nfe-proxy` estiver implementada,
// estas funções farão a ponte com a API Focus NFe.

/**
 * Transmitir documento fiscal para SEFAZ via Focus NFe.
 * Requer: secret FOCUS_NFE_TOKEN configurado.
 */
export async function transmitirParaSefaz(notaId: string): Promise<{ success: boolean; message: string }> {
  // TODO: Implementar quando edge function focus-nfe-proxy estiver disponível
  // const { data, error } = await supabase.functions.invoke("focus-nfe-proxy", {
  //   body: { action: "transmitir", nota_id: notaId }
  // });
  
  // Por enquanto, simula o envio e atualiza o status
  await atualizarNota(notaId, { status: "processando" });
  return { success: true, message: "Documento enviado para processamento. Integre com Focus NFe para transmissão real." };
}

/**
 * Cancelar documento fiscal na SEFAZ via Focus NFe.
 */
export async function cancelarNaSefaz(notaId: string, motivo: string): Promise<{ success: boolean; message: string }> {
  await atualizarNota(notaId, { 
    status: "cancelada", 
    motivo_cancelamento: motivo,
    data_cancelamento: new Date().toISOString()
  });
  return { success: true, message: "Cancelamento registrado. Integre com Focus NFe para cancelamento na SEFAZ." };
}

/**
 * Enviar carta de correção via Focus NFe.
 */
export async function enviarCartaCorrecao(notaId: string, correcao: string): Promise<{ success: boolean; message: string }> {
  await atualizarNota(notaId, { carta_correcao: correcao });
  return { success: true, message: "Carta de correção registrada. Integre com Focus NFe para envio à SEFAZ." };
}

/**
 * Inutilizar faixa de numeração via Focus NFe.
 */
export async function inutilizarNumeracao(_serie: string, _numeroInicio: number, _numeroFim: number, _justificativa: string): Promise<{ success: boolean; message: string }> {
  return { success: true, message: "Inutilização registrada. Integre com Focus NFe para inutilização na SEFAZ." };
}

/**
 * Consultar status do documento na SEFAZ.
 */
export async function consultarStatusSefaz(notaId: string): Promise<{ success: boolean; status: string; message: string }> {
  const nota = await obterNota(notaId);
  return { success: true, status: nota.status, message: `Status atual: ${nota.status}` };
}
