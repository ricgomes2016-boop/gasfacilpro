import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { criarMovimentacaoBancaria, resolverContaDestino } from "@/services/paymentRoutingService";

/**
 * Linha de pagamento usada para liquidar UM recebível (fiado/vale/boleto/cheque).
 * Mesma semântica do fluxo "Nova Venda" (rotearPagamentosVenda):
 *  - dinheiro → caixa da loja
 *  - pix → conta bancária (chave)
 *  - cartao_debito/cartao_credito/pix_maquininha → cria novo recebível do adquirente D+X
 *  - transferencia/boleto_pago → conta bancária
 *  - cheque → tabela cheques + caixa (referência)
 */
export interface LinhaLiquidacao {
  forma:
    | "dinheiro"
    | "pix"
    | "pix_maquininha"
    | "cartao_debito"
    | "cartao_credito"
    | "transferencia"
    | "boleto_pago"
    | "cheque";
  valor: number;
  parcelas?: number;
  // PIX
  chave_pix?: string;
  conta_bancaria_id?: string;
  // Cartão / pix maq
  operadora_id?: string;
  operadora_nome?: string;
  operadora_taxa?: number;
  operadora_prazo?: number;
  operadora_conta_bancaria_id?: string | null;
  terminal_id?: string;
  // Cheque
  cheque_numero?: string;
  cheque_banco?: string;
  cheque_bom_para?: string;
}

export interface RecebivelParaLiquidar {
  id: string;
  cliente: string | null;
  cliente_id?: string | null;
  descricao: string | null;
  pedido_id?: string | null;
  unidade_id?: string | null;
  valor: number;
  forma_pagamento?: string | null;
  observacoes?: string | null;
}

export interface LiquidarResult {
  ok: boolean;
  parcial: boolean;
  totalPago: number;
  restante: number;
}

/**
 * Liquida um recebível aplicando múltiplas linhas de pagamento.
 * Persiste os side-effects (caixa/banco/cartão/cheque) e atualiza `contas_receber`.
 */
export async function liquidarRecebivel(
  conta: RecebivelParaLiquidar,
  linhas: LinhaLiquidacao[],
  dataRecebimento: string
): Promise<LiquidarResult> {
  const hoje = getBrasiliaDateString();
  const dataRec = dataRecebimento || hoje;
  const totalPago = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const valorConta = Number(conta.valor) || 0;
  const restante = Math.max(0, valorConta - totalPago);
  const parcial = totalPago < valorConta - 0.01;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  const ref = conta.pedido_id?.slice(0, 8) || conta.id.slice(0, 8);
  const clienteNome = conta.cliente || "Cliente";
  const origem = conta.forma_pagamento === "vale_gas" ? "Vale Gás" : "Fiado";

  for (const linha of linhas) {
    const valor = Number(linha.valor) || 0;
    if (valor <= 0) continue;

    switch (linha.forma) {
      case "dinheiro": {
        await supabase.from("movimentacoes_caixa").insert({
          tipo: "entrada",
          descricao: `Pgto ${origem} #${ref} - Dinheiro`,
          valor,
          categoria: `Recebimento ${origem}`,
          status: "aprovada",
          pedido_id: conta.pedido_id || null,
          unidade_id: conta.unidade_id || null,
        });
        break;
      }
      case "pix": {
        const contaId =
          linha.conta_bancaria_id ||
          (await resolverContaDestino({
            unidadeId: conta.unidade_id,
            forma: "pix",
          }));
        if (contaId) {
          await criarMovimentacaoBancaria({
            contaBancariaId: contaId,
            valor,
            descricao: `Pgto ${origem} #${ref} - PIX${linha.chave_pix ? ` (${linha.chave_pix.slice(0, 12)}…)` : ""}`,
            categoria: `recebimento_${origem === "Vale Gás" ? "vale_gas" : "fiado"}`,
            unidadeId: conta.unidade_id || undefined,
            userId,
            pedidoId: conta.pedido_id || undefined,
          });
        }
        break;
      }
      case "transferencia":
      case "boleto_pago": {
        const contaId =
          linha.conta_bancaria_id ||
          (await resolverContaDestino({
            unidadeId: conta.unidade_id,
            forma: linha.forma === "boleto_pago" ? "boleto" : "transferencia",
          }));
        if (contaId) {
          await criarMovimentacaoBancaria({
            contaBancariaId: contaId,
            valor,
            descricao: `Pgto ${origem} #${ref} - ${linha.forma === "boleto_pago" ? "Boleto pago" : "TED/Transferência"}`,
            categoria: `recebimento_${origem === "Vale Gás" ? "vale_gas" : "fiado"}`,
            unidadeId: conta.unidade_id || undefined,
            userId,
            pedidoId: conta.pedido_id || undefined,
          });
        }
        break;
      }
      case "cartao_debito":
      case "cartao_credito":
      case "pix_maquininha": {
        // Cria NOVO recebível do adquirente (D+X) — igual ao fluxo Nova Venda.
        const taxa = Number(linha.operadora_taxa) || 0;
        const prazo = Number(linha.operadora_prazo) || (linha.forma === "cartao_credito" ? 30 : 1);
        const valorTaxa = valor * (taxa / 100);
        const valorLiquido = valor - valorTaxa;
        const tipoLabel =
          linha.forma === "cartao_debito"
            ? "Débito"
            : linha.forma === "cartao_credito"
            ? "Crédito"
            : "PIX Maq.";
        const contaDestino = await resolverContaDestino({
          unidadeId: conta.unidade_id,
          forma: linha.forma,
          terminalId: linha.terminal_id,
          operadoraContaId: linha.operadora_conta_bancaria_id || null,
        });
        await supabase.from("contas_receber").insert({
          cliente: linha.operadora_nome || "Operadora Cartão",
          descricao: `${tipoLabel} - Liquidação ${origem} #${ref}${linha.parcelas && linha.parcelas > 1 ? ` (${linha.parcelas}x)` : ""}`,
          valor,
          vencimento: format(addDays(new Date(dataRec + "T12:00:00"), prazo), "yyyy-MM-dd"),
          status: "pendente",
          forma_pagamento: linha.forma,
          pedido_id: conta.pedido_id || null,
          unidade_id: conta.unidade_id || null,
          operadora_id: linha.operadora_id || null,
          taxa_percentual: taxa,
          valor_taxa: valorTaxa,
          valor_liquido: valorLiquido,
          parcela_atual: 1,
          total_parcelas: linha.forma === "cartao_credito" ? Math.max(1, Number(linha.parcelas) || 1) : 1,
          cliente_id: conta.cliente_id || null,
          conta_bancaria_destino_id: contaDestino,
        } as any);
        break;
      }
      case "cheque": {
        await supabase.from("movimentacoes_caixa").insert({
          tipo: "entrada",
          descricao: `Pgto ${origem} #${ref} - Cheque${linha.cheque_numero ? ` #${linha.cheque_numero}` : ""}`,
          valor,
          categoria: `Recebimento ${origem}`,
          status: "aprovada",
          pedido_id: conta.pedido_id || null,
          unidade_id: conta.unidade_id || null,
        });
        if (linha.cheque_numero && linha.cheque_banco) {
          await supabase.from("cheques").insert({
            numero_cheque: linha.cheque_numero,
            banco_emitente: linha.cheque_banco,
            valor,
            data_emissao: dataRec,
            data_vencimento: linha.cheque_bom_para || dataRec,
            status: "em_maos",
            pedido_id: conta.pedido_id || null,
            cliente_id: conta.cliente_id || null,
            unidade_id: conta.unidade_id || null,
            user_id: userId || null,
          } as any);
        }
        break;
      }
    }
  }

  // Descreve as formas usadas para gravar em `forma_pagamento`.
  const formasStr = linhas
    .filter((l) => l.valor > 0)
    .map((l) => `${labelForma(l)}: R$ ${Number(l.valor).toFixed(2)}`)
    .join(", ");

  if (parcial) {
    // Reduz valor da conta original e mantém pendente
    const obs = `${conta.observacoes || ""}\nRecebido parcial R$ ${totalPago.toFixed(2)} em ${format(
      new Date(dataRec + "T12:00:00"),
      "dd/MM/yyyy"
    )} (${formasStr})`.trim();
    await supabase
      .from("contas_receber")
      .update({ valor: restante, observacoes: obs } as any)
      .eq("id", conta.id);
  } else {
    await supabase
      .from("contas_receber")
      .update({
        status: "recebida",
        forma_pagamento: formasStr || conta.forma_pagamento,
        data_recebimento: dataRec,
      } as any)
      .eq("id", conta.id);
  }

  return { ok: true, parcial, totalPago, restante };
}

function labelForma(l: LinhaLiquidacao): string {
  switch (l.forma) {
    case "dinheiro":
      return "Dinheiro";
    case "pix":
      return "PIX";
    case "pix_maquininha":
      return `PIX Maq. (${l.operadora_nome || "operadora"})`;
    case "cartao_debito":
      return `Débito (${l.operadora_nome || "operadora"})`;
    case "cartao_credito":
      return `Crédito ${l.parcelas && l.parcelas > 1 ? `${l.parcelas}x ` : ""}(${l.operadora_nome || "operadora"})`;
    case "transferencia":
      return "Transferência";
    case "boleto_pago":
      return "Boleto pago";
    case "cheque":
      return `Cheque${l.cheque_numero ? ` #${l.cheque_numero}` : ""}`;
    default:
      return l.forma;
  }
}
