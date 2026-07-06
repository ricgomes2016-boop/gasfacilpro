import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { addDays, format } from "date-fns";

export interface PagamentoRoteamento {
  forma: string;
  valor: number;
  cheque_numero?: string;
  cheque_banco?: string;
  cheque_foto_url?: string;
  data_vencimento_fiado?: string;
  vale_gas_id?: string;
  vale_gas_parceiro_id?: string;
  vale_gas_parceiro_nome?: string;
  vale_gas_numero?: number;
  vale_gas_codigo?: string;
  // Cartão / PIX Maquininha — escolha do atendente/entregador
  operadora_id?: string;
  terminal_id?: string;
  conta_bancaria_id?: string;
}

interface RotearPagamentosParams {
  pedidoId: string;
  pedidoNumero?: string | number | null;
  clienteId?: string | null;
  clienteNome?: string;
  pagamentos: PagamentoRoteamento[];
  unidadeId?: string | null;
  entregadorId?: string | null;
  userId?: string;
}

/**
 * Busca a conta bancária principal da unidade (primeira conta ativa) — FALLBACK APENAS.
 * Nunca deve ser chamada diretamente pelos fluxos de venda/recebimento.
 * Use `resolverContaDestino` que aplica a precedência correta.
 */
async function getContaPrincipal(unidadeId?: string | null): Promise<string | null> {
  if (!unidadeId) return null;
  const { data } = await supabase
    .from("contas_bancarias")
    .select("id")
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

/**
 * Resolve a conta bancária de destino para QUALQUER forma de pagamento.
 *
 * Precedência única (fonte de verdade financeira):
 *   1. Explícito na chamada    (contaExplicita — escolha do atendente/entregador no ato)
 *   2. Terminal cartão          (terminais_cartao.conta_bancaria_id)
 *   3. Operadora                (operadoras_cartao.conta_bancaria_id — passado como operadoraContaId)
 *   4. Config por forma/unidade (config_destino_pagamento onde forma_pagamento = forma)
 *   5. Fallback: primeira conta ativa da unidade
 *
 * Para custom_avista_X / custom_aprazo_X, também consulta formas_pagamento_custom.conta_bancaria_id
 * antes do config_destino_pagamento.
 */
export async function resolverContaDestino(params: {
  unidadeId?: string | null;
  forma: string;
  contaExplicita?: string | null;
  terminalId?: string | null;
  operadoraContaId?: string | null;
}): Promise<string | null> {
  const { unidadeId, forma, contaExplicita, terminalId, operadoraContaId } = params;

  // 1. Explícito
  if (contaExplicita) return contaExplicita;

  // 2. Terminal
  if (terminalId) {
    const { data } = await supabase
      .from("terminais_cartao")
      .select("conta_bancaria_id")
      .eq("id", terminalId)
      .maybeSingle();
    if ((data as any)?.conta_bancaria_id) return (data as any).conta_bancaria_id as string;
  }

  // 3. Operadora (só faz sentido para cartão/pix_maq)
  if (operadoraContaId) return operadoraContaId;

  // 3.5 Forma customizada tem conta própria
  if (forma?.startsWith("custom_")) {
    const { data: custom } = await (supabase as any)
      .from("formas_pagamento_custom")
      .select("conta_bancaria_id")
      .eq("slug", forma)
      .maybeSingle();
    if (custom?.conta_bancaria_id) return custom.conta_bancaria_id as string;
  }

  // 4. Config por forma/unidade
  if (unidadeId) {
    const { data: cfg } = await supabase
      .from("config_destino_pagamento")
      .select("conta_bancaria_id, ativo")
      .eq("unidade_id", unidadeId)
      .eq("forma_pagamento", forma)
      .maybeSingle();
    if (cfg?.ativo !== false && cfg?.conta_bancaria_id) return cfg.conta_bancaria_id as string;
  }

  // 5. Fallback
  return getContaPrincipal(unidadeId);
}

/**
 * Busca operadora ativa da unidade e calcula taxa/prazo.
 * Se operadoraId for fornecido (escolha do atendente/entregador), usa essa.
 * Caso contrário, cai na primeira ativa da unidade.
 */
async function getOperadoraConfig(unidadeId: string | null, tipo: string, operadoraId?: string | null) {
  let query = supabase
    .from("operadoras_cartao")
    .select("id, nome, taxa_debito, taxa_credito_vista, taxa_credito_parcelado, prazo_debito, prazo_credito, taxa_pix, prazo_pix, conta_bancaria_id");

  if (operadoraId) {
    query = query.eq("id", operadoraId);
  } else {
    if (!unidadeId) return null;
    query = query.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`).eq("ativo", true);
  }

  const { data } = await query.limit(1).maybeSingle();
  if (!data) return null;

  let taxa = 0;
  let prazo = 0;
  if (tipo === "pix_maquininha") {
    taxa = Number((data as any).taxa_pix) || 0;
    prazo = Number((data as any).prazo_pix) || 0;
  } else if (tipo === "cartao_debito" || tipo === "debito") {
    taxa = Number(data.taxa_debito) || 0;
    prazo = Number(data.prazo_debito) || 1;
  } else {
    taxa = Number(data.taxa_credito_vista) || 0;
    prazo = Number(data.prazo_credito) || 30;
  }

  return { id: data.id, nome: data.nome, taxa, prazo, conta_bancaria_id: (data as any).conta_bancaria_id as string | null };
}

/**
 * Cria movimentação bancária e atualiza saldo da conta
 */
export async function criarMovimentacaoBancaria(params: {
  contaBancariaId: string;
  valor: number;
  descricao: string;
  categoria: string;
  unidadeId?: string | null;
  userId?: string;
  pedidoId?: string;
}) {
  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("saldo_atual")
    .eq("id", params.contaBancariaId)
    .single();

  if (!conta) return;

  // Idempotência: se já existe uma movimentação bancária para este pedido nesta conta
  // (mesmo referencia_tipo/categoria), não duplica.
  if (params.pedidoId) {
    const { data: jaExiste } = await supabase
      .from("movimentacoes_bancarias")
      .select("id")
      .eq("referencia_id", params.pedidoId)
      .eq("referencia_tipo", "pedido")
      .eq("categoria", params.categoria)
      .eq("conta_bancaria_id", params.contaBancariaId)
      .maybeSingle();
    if (jaExiste) return;
  }

  const novoSaldo = Number(conta.saldo_atual) + params.valor;

  await supabase.from("movimentacoes_bancarias").insert({
    conta_bancaria_id: params.contaBancariaId,
    data: getBrasiliaDateString(),
    tipo: params.valor >= 0 ? "entrada" : "saida",
    categoria: params.categoria,
    descricao: params.descricao,
    valor: params.valor,
    saldo_apos: novoSaldo,
    referencia_id: params.pedidoId || null,
    referencia_tipo: params.pedidoId ? "pedido" : null,
    user_id: params.userId || null,
    unidade_id: params.unidadeId || null,
  });


  await supabase
    .from("contas_bancarias")
    .update({ saldo_atual: novoSaldo })
    .eq("id", params.contaBancariaId);
}

/**
 * Roteia automaticamente os pagamentos de uma venda.
 * 
 * Fluxo: Venda → Geração de título → Recebimento → Baixa → Conciliação
 * 
 * - Dinheiro → movimentacoes_caixa (caixa físico)
 * - PIX → movimentacoes_bancarias DIRETO (conta principal)
 * - Cartão Débito → contas_receber (operadora, taxa, D+1)
 * - Cartão Crédito → contas_receber (operadora, taxa, D+30)
 * - PIX Maquininha → contas_receber (operadora, taxa, D+0/D+1)
 * - Cheque → movimentacoes_caixa + tabela cheques
 * - Fiado → contas_receber vinculada ao cliente
 * - Boleto → contas_receber
 * - Vale Gás → apenas baixa o voucher; o título do parceiro é gerado na emissão do lote (ValeGasEmissao)
 */
export async function rotearPagamentosVenda(params: RotearPagamentosParams): Promise<void> {
  const { pedidoId, clienteId, clienteNome, pagamentos, unidadeId, entregadorId } = params;
  const hoje = getBrasiliaDateString();
  const pedidoRef = params.pedidoNumero != null ? String(params.pedidoNumero) : pedidoId.slice(0, 8).toUpperCase();

  const { data: { user } } = await supabase.auth.getUser();
  const userId = params.userId || user?.id;

  const promises: PromiseLike<any>[] = [];

  const insertCaixa = (data: any) =>
    supabase.from("movimentacoes_caixa").insert(data).select("id").then(r => { if (r.error) throw r.error; });

  const insertContasReceber = (data: any) =>
    supabase.from("contas_receber").insert(data).select("id").then(r => { if (r.error) throw r.error; });

  const insertCheque = (data: any) =>
    supabase.from("cheques").insert(data).select("id").then(r => { if (r.error) throw r.error; });

  const totalVenda = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const formasUsadas = pagamentos.map(p => p.forma).join(", ");

  // Helper de idempotência: evita duplicar movimentacoes_caixa quando a mesma venda
  // passa por rotearPagamentosVenda mais de uma vez (PDV → finalização → acerto).
  const jaTemMovCaixa = async (categoria: string): Promise<boolean> => {
    const { data } = await supabase
      .from("movimentacoes_caixa")
      .select("id")
      .eq("pedido_id", pedidoId)
      .eq("categoria", categoria)
      .maybeSingle();
    return !!data;
  };

  for (const pag of pagamentos) {
    switch (pag.forma) {
      case "dinheiro": {
        promises.push((async () => {
          if (await jaTemMovCaixa("Venda Dinheiro")) return;
          await insertCaixa({
            tipo: "entrada",
            descricao: `Venda #${pedidoRef} - Dinheiro`,
            valor: pag.valor,
            categoria: "Venda Dinheiro",
            status: "aprovada",
            pedido_id: pedidoId,
            unidade_id: unidadeId || null,
            entregador_id: entregadorId || null,
          });
        })());
        break;
      }


      case "pix": {
        promises.push(
          getContaPrincipal(unidadeId).then(contaId => {
            if (contaId) {
              return criarMovimentacaoBancaria({
                contaBancariaId: contaId,
                valor: pag.valor,
                descricao: `Venda #${pedidoRef} - PIX`,
                categoria: "venda",
                unidadeId,
                userId,
                pedidoId,
              });
            }
          })
        );
        break;
      }

      case "cartao_debito":
      case "debito":
      case "cartao_credito":
      case "credito":
      case "pix_maquininha": {
        // Cartões e PIX Maquininha → contas_receber com operadora + taxa + prazo
        promises.push(
          (async () => {
            const op = await getOperadoraConfig(unidadeId || null, pag.forma, pag.operadora_id);
            const taxa = op ? op.taxa : 0;
            const prazo = op ? op.prazo : (pag.forma.includes("debito") ? 1 : 30);
            const valorTaxa = pag.valor * (taxa / 100);
            const valorLiquido = pag.valor - valorTaxa;

            const tipoLabel = pag.forma.includes("debito") || pag.forma === "debito"
              ? "Débito" : pag.forma === "pix_maquininha" ? "PIX Maq." : "Crédito";

            const contaDestino = await resolverContaDestino({
              unidadeId,
              forma: pag.forma,
              contaExplicita: pag.conta_bancaria_id,
              terminalId: pag.terminal_id,
              operadoraContaId: op?.conta_bancaria_id || null,
            });

            await insertContasReceber({
              cliente: op?.nome || clienteNome || "Operadora Cartão",
              descricao: `${tipoLabel} - Venda #${pedidoRef}`,
              valor: pag.valor,
              vencimento: format(addDays(new Date(), prazo), "yyyy-MM-dd"),
              status: "pendente",
              forma_pagamento: pag.forma === "debito" ? "cartao_debito" : pag.forma === "credito" ? "cartao_credito" : pag.forma,
              pedido_id: pedidoId,
              unidade_id: unidadeId || null,
              operadora_id: op?.id || null,
              taxa_percentual: taxa,
              valor_taxa: valorTaxa,
              valor_liquido: valorLiquido,
              cliente_id: clienteId || null,
              conta_bancaria_destino_id: contaDestino,
            });
          })()
        );
        break;
      }

      case "cheque": {
        promises.push((async () => {
          if (await jaTemMovCaixa("Cheque")) return;
          await insertCaixa({
            tipo: "entrada",
            descricao: `Venda #${pedidoRef} - Cheque #${pag.cheque_numero || "s/n"}`,
            valor: pag.valor,
            categoria: "Cheque",
            status: "aprovada",
            pedido_id: pedidoId,
            unidade_id: unidadeId || null,
            entregador_id: entregadorId || null,
          });
        })());
        if (userId && pag.cheque_numero && pag.cheque_banco) {
          promises.push(insertCheque({
            numero_cheque: pag.cheque_numero,
            banco_emitente: pag.cheque_banco,
            valor: pag.valor,
            data_emissao: hoje,
            data_vencimento: hoje,
            status: "em_maos",
            pedido_id: pedidoId,
            cliente_id: clienteId || null,
            unidade_id: unidadeId || null,
            user_id: userId,
            foto_url: pag.cheque_foto_url || null,
          }));
        }
        break;
      }

      case "fiado": {
        const vencimento = pag.data_vencimento_fiado || format(addDays(new Date(), 30), "yyyy-MM-dd");
        promises.push(insertContasReceber({
          cliente: clienteNome || "Cliente não identificado",
          descricao: `Venda a prazo (Fiado) - Pedido #${pedidoRef}`,
          valor: pag.valor,
          vencimento,
          status: "pendente",
          forma_pagamento: "fiado",
          pedido_id: pedidoId,
          unidade_id: unidadeId || null,
          cliente_id: clienteId || null,
        }));
        break;
      }

      case "boleto": {
        promises.push(insertContasReceber({
          cliente: clienteNome || "Cliente não identificado",
          descricao: `Boleto - Venda #${pedidoRef}`,
          valor: pag.valor,
          vencimento: format(addDays(new Date(), 30), "yyyy-MM-dd"),
          status: "pendente",
          forma_pagamento: "boleto",
          pedido_id: pedidoId,
          unidade_id: unidadeId || null,
          cliente_id: clienteId || null,
        }));
        break;
      }

      case "vale_gas": {
        // Vale Gás NÃO gera contas_receber na venda.
        // O título financeiro vive no LOTE (vinculado ao parceiro), criado em ValeGasEmissao.
        // Aqui apenas marcamos o(s) voucher(s) como utilizado(s) para rastreabilidade.
        // Suporta múltiplos vales por pagamento via (pag as any).vales: [{id}, ...]
        const ids: string[] = Array.isArray((pag as any).vales) && (pag as any).vales.length
          ? (pag as any).vales.map((v: any) => v.id).filter(Boolean)
          : (pag.vale_gas_id ? [pag.vale_gas_id] : []);
        if (ids.length) {
          promises.push((async () => {
            await (supabase as any).from("vale_gas").update({
              status: "utilizado",
              data_utilizacao: new Date().toISOString(),
              venda_id: pedidoId,
              cliente_id: clienteId || null,
              cliente_nome: clienteNome || null,
            }).in("id", ids);
          })());
        }
        break;
      }

      case "gas_do_povo": {
        // Programa Gás do Povo (governo): recebível D+2, taxa 0%.
        // Tratado como recebível tipo cartão para aparecer na Conciliação Cartão.
        const dataPrevista = format(addDays(new Date(), 2), "yyyy-MM-dd");
        promises.push(insertContasReceber({
          cliente: "Programa Gás do Povo",
          descricao: `Gás do Povo - Venda #${pedidoRef}`,
          valor: pag.valor,
          vencimento: dataPrevista,
          status: "pendente",
          forma_pagamento: "gas_do_povo",
          pedido_id: pedidoId,
          unidade_id: unidadeId || null,
          taxa_percentual: 0,
          valor_taxa: 0,
          valor_liquido: pag.valor,
          cliente_id: clienteId || null,
        }));
        // Também aparece em Gestão de Cartões (Conferência) como "maquininha azulzinha"
        promises.push((async () => {
          const { error } = await supabase.from("conferencia_cartao").insert({
            pedido_id: pedidoId,
            operadora_id: null,
            tipo: "gas_do_povo",
            bandeira: "Gás do Povo",
            valor_bruto: pag.valor,
            taxa_percentual: 0,
            valor_taxa: 0,
            valor_liquido_esperado: pag.valor,
            data_venda: hoje,
            data_prevista_deposito: dataPrevista,
            parcelas: 1,
            status: "pendente",
            unidade_id: unidadeId || null,
          });
          if (error) throw error;
        })());
        break;
      }

      default: {
        // Formas customizadas cadastradas em Financeiro → Formas de Pagamento
        if (pag.forma?.startsWith("custom_avista_")) {
          // À vista: se houver conta bancária destino cadastrada, credita direto.
          // Caso contrário, entra no caixa da loja.
          promises.push((async () => {
            const { data: custom } = await (supabase as any)
              .from("formas_pagamento_custom")
              .select("nome, conta_bancaria_id")
              .eq("slug", pag.forma)
              .maybeSingle();
            const nome = custom?.nome || "Personalizado";
            const contaId = custom?.conta_bancaria_id || null;
            if (contaId) {
              await criarMovimentacaoBancaria({
                contaBancariaId: contaId,
                valor: pag.valor,
                descricao: `Venda #${pedidoRef} - ${nome}`,
                categoria: "venda",
                unidadeId,
                userId,
                pedidoId,
              });
            } else {
              await insertCaixa({
                tipo: "entrada",
                descricao: `Venda #${pedidoRef} - ${nome}`,
                valor: pag.valor,
                categoria: nome,
                status: "aprovada",
                pedido_id: pedidoId,
                unidade_id: unidadeId || null,
                entregador_id: entregadorId || null,
              });
            }
          })());
        } else if (pag.forma?.startsWith("custom_aprazo_")) {
          // A prazo: gera título em contas_receber
          promises.push((async () => {
            const { data: custom } = await (supabase as any)
              .from("formas_pagamento_custom")
              .select("nome")
              .eq("slug", pag.forma)
              .maybeSingle();
            const nome = custom?.nome || "Personalizado";
            await insertContasReceber({
              cliente: clienteNome || "Cliente não identificado",
              descricao: `${nome} - Pedido #${pedidoRef}`,
              valor: pag.valor,
              vencimento: format(addDays(new Date(), 30), "yyyy-MM-dd"),
              status: "pendente",
              forma_pagamento: pag.forma,
              pedido_id: pedidoId,
              unidade_id: unidadeId || null,
              cliente_id: clienteId || null,
            });
          })());
        }
        break;
      }
    }
  }

  const results = await Promise.allSettled(promises);
  const failures = results.filter(r => r.status === "rejected");
  if (failures.length > 0) {
    console.error("Erros ao rotear pagamentos:", failures);
  }

  // Notificação consolidada
  await supabase.from("notificacoes").insert({
    titulo: "💰 Nova venda registrada",
    mensagem: `Venda #${pedidoRef} — R$ ${totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${formasUsadas}). Títulos financeiros gerados automaticamente.`,
    tipo: "info",
    user_id: userId || "",
  }).then(r => { if (r.error) console.error("Erro notificação:", r.error); });
}
