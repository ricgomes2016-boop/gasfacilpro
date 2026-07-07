import { supabase } from "@/integrations/supabase/client";

export type FormaPagamentoCompra =
  | "dinheiro"
  | "pix"
  | "ted"
  | "debito"
  | "credito"
  | "boleto"
  | "cheque"
  | "vale_central_gas"
  | "vale_ultragaz"
  | "a_prazo";

export interface DadosPagamentoCompra {
  forma: FormaPagamentoCompra;
  valor: number;
  data_pagamento?: string | null;
  conta_bancaria_id?: string | null;
  caixa_sessao_id?: string | null;
  parcelas?: number;
  // cheque
  numero_cheque?: string | null;
  banco_cheque?: string | null;
  bom_para?: string | null;
  // metadata
  descricao: string;
  fornecedor?: string | null;
  unidade_id?: string | null;
}

const LABEL: Record<FormaPagamentoCompra, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  ted: "TED/Transferência",
  debito: "Cartão de Débito",
  credito: "Cartão de Crédito",
  boleto: "Boleto",
  cheque: "Cheque",
  vale_central_gas: "Vale Central Gás",
  vale_ultragaz: "Vale Ultragaz",
  a_prazo: "A prazo",
};

/**
 * Cria os lançamentos financeiros de uma compra conforme a forma escolhida.
 * Idempotente: chame reverterPagamentoCompra() antes de reprocessar.
 */
export async function registrarPagamentoCompra(
  compraId: string,
  d: DadosPagamentoCompra
) {
  const hoje = d.data_pagamento || new Date().toISOString().slice(0, 10);

  // Dinheiro → movimentacoes_caixa (saída)
  if (d.forma === "dinheiro") {
    const { error } = await supabase.from("movimentacoes_caixa").insert({
      tipo: "saida",
      categoria: "compras",
      valor: d.valor,
      descricao: d.descricao,
      status: "aprovado",
      unidade_id: d.unidade_id || null,
      compra_id: compraId,
      observacoes: `Pagamento em dinheiro · ${d.fornecedor || ""}`.trim(),
    } as any);
    if (error) throw error;
    await supabase.from("compras").update({ pago: true, data_pagamento: hoje }).eq("id", compraId);
    return;
  }

  // PIX, TED, Débito, Boleto, Vale Central Gás, Vale Ultragaz → movimentacoes_bancarias (saída)
  if (["pix", "ted", "debito", "boleto", "vale_central_gas", "vale_ultragaz"].includes(d.forma)) {
    if (!d.conta_bancaria_id) throw new Error("Selecione a conta bancária de origem.");

    const { data: conta } = await supabase
      .from("contas_bancarias")
      .select("saldo_atual")
      .eq("id", d.conta_bancaria_id)
      .single();
    const saldoAtual = Number(conta?.saldo_atual || 0);
    const saldoApos = saldoAtual - d.valor;

    const { error: mErr } = await supabase.from("movimentacoes_bancarias").insert({
      conta_bancaria_id: d.conta_bancaria_id,
      tipo: "saida",
      categoria: "compras",
      valor: d.valor,
      descricao: d.descricao,
      data: hoje,
      saldo_apos: saldoApos,
      referencia_id: compraId,
      referencia_tipo: "compra",
      unidade_id: d.unidade_id || null,
      observacoes: `${LABEL[d.forma]} · ${d.fornecedor || ""}`.trim(),
    } as any);
    if (mErr) throw mErr;

    await supabase
      .from("contas_bancarias")
      .update({ saldo_atual: saldoApos })
      .eq("id", d.conta_bancaria_id);

    await supabase.from("compras").update({ pago: true, data_pagamento: hoje }).eq("id", compraId);
    return;
  }

  // Cheque → cheques + conta a pagar
  if (d.forma === "cheque") {
    if (!d.numero_cheque) throw new Error("Informe o número do cheque.");
    const vencimento = d.bom_para || hoje;
    const { error: cErr } = await supabase.from("cheques").insert({
      numero_cheque: d.numero_cheque,
      banco_emitente: d.banco_cheque || null,
      valor: d.valor,
      data_emissao: hoje,
      data_vencimento: vencimento,
      status: "emitido",
      unidade_id: d.unidade_id || null,
      compra_id: compraId,
      depositado_em_conta_id: d.conta_bancaria_id || null,
      observacoes: `Compra · ${d.fornecedor || ""}`.trim(),
    } as any);
    if (cErr) throw cErr;

    await supabase.from("contas_pagar").insert({
      descricao: d.descricao,
      fornecedor: d.fornecedor || "",
      valor: d.valor,
      vencimento,
      categoria: "compras",
      status: "pendente",
      unidade_id: d.unidade_id || null,
      compra_id: compraId,
      forma_pagamento: "cheque",
      conta_bancaria_id: d.conta_bancaria_id || null,
    } as any);
    return;
  }

  // Cartão de crédito → contas_pagar (parcelas)
  if (d.forma === "credito") {
    const parcelas = Math.max(1, d.parcelas || 1);
    const valorParcela = +(d.valor / parcelas).toFixed(2);
    const grupoId = crypto.randomUUID();
    const linhas = Array.from({ length: parcelas }).map((_, i) => {
      const venc = new Date(hoje + "T12:00:00");
      venc.setMonth(venc.getMonth() + (i + 1));
      return {
        descricao: `${d.descricao} (${i + 1}/${parcelas})`,
        fornecedor: d.fornecedor || "",
        valor: i === parcelas - 1 ? +(d.valor - valorParcela * (parcelas - 1)).toFixed(2) : valorParcela,
        vencimento: venc.toISOString().slice(0, 10),
        categoria: "compras",
        status: "pendente",
        unidade_id: d.unidade_id || null,
        compra_id: compraId,
        forma_pagamento: "credito",
        conta_bancaria_id: d.conta_bancaria_id || null,
        parcela_numero: i + 1,
        parcela_total: parcelas,
        grupo_parcela_id: grupoId,
      };
    });
    const { error } = await supabase.from("contas_pagar").insert(linhas as any);
    if (error) throw error;
    return;
  }

  // A prazo → 1 conta a pagar
  if (d.forma === "a_prazo") {
    const { error } = await supabase.from("contas_pagar").insert({
      descricao: d.descricao,
      fornecedor: d.fornecedor || "",
      valor: d.valor,
      vencimento: d.data_pagamento || hoje,
      categoria: "compras",
      status: "pendente",
      unidade_id: d.unidade_id || null,
      compra_id: compraId,
      forma_pagamento: "a_prazo",
      conta_bancaria_id: d.conta_bancaria_id || null,
    } as any);
    if (error) throw error;
    return;
  }
}

/**
 * Reverte lançamentos financeiros associados a uma compra (usado ao excluir).
 * Restaura o saldo da conta bancária impactada.
 */
export async function reverterPagamentoCompra(compraId: string) {
  // Movimentações bancárias — restaurar saldo antes de deletar
  const { data: mvBanco } = await supabase
    .from("movimentacoes_bancarias")
    .select("id, conta_bancaria_id, valor, tipo")
    .eq("referencia_id", compraId)
    .eq("referencia_tipo", "compra");

  if (mvBanco?.length) {
    for (const m of mvBanco) {
      if (!m.conta_bancaria_id) continue;
      const { data: c } = await supabase
        .from("contas_bancarias")
        .select("saldo_atual")
        .eq("id", m.conta_bancaria_id)
        .single();
      const delta = m.tipo === "saida" ? Number(m.valor) : -Number(m.valor);
      await supabase
        .from("contas_bancarias")
        .update({ saldo_atual: Number(c?.saldo_atual || 0) + delta })
        .eq("id", m.conta_bancaria_id);
    }
    await supabase
      .from("movimentacoes_bancarias")
      .delete()
      .eq("referencia_id", compraId)
      .eq("referencia_tipo", "compra");
  }

  await supabase.from("movimentacoes_caixa").delete().eq("compra_id", compraId);
  await supabase.from("contas_pagar").delete().eq("compra_id", compraId);
  await supabase.from("cheques").delete().eq("compra_id", compraId);
}
