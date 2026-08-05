import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { getBancoPadrao, getOperadoraPadrao, matchesNomePadrao } from "@/lib/financeiro/padroesFinanceiros";
import { prazoOperadoraD0 } from "@/lib/financeiro/operadoraRecebimento";

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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
  parcelas?: number;
  taxa_desconto_percentual?: number;
  taxa_total_percentual?: number;
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

  // 4.5 Banco padrão por forma (ex.: PIX → Itaú)
  const bancoPadrao = getBancoPadrao(forma);
  if (bancoPadrao && unidadeId) {
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("id, nome, banco")
      .eq("unidade_id", unidadeId)
      .eq("ativo", true);
    const hit = (contas || []).find(
      (c: any) => matchesNomePadrao(c.banco, bancoPadrao) || matchesNomePadrao(c.nome, bancoPadrao)
    );
    if (hit?.id) return hit.id as string;
  }

  // 5. Fallback
  return getContaPrincipal(unidadeId);
}

/**
 * Busca operadora ativa da unidade e calcula taxa/prazo.
 * Se operadoraId for fornecido (escolha do atendente/entregador), usa essa.
 * Caso contrário, cai na primeira ativa da unidade.
 */
async function getOperadoraConfig(unidadeId: string | null, tipo: string, operadoraId?: string | null, parcelas = 1) {
  let query = supabase
    .from("operadoras_cartao")
    .select("id, nome, taxa_debito, taxa_credito_vista, taxa_credito_parcelado, prazo_debito, prazo_credito, taxa_pix, prazo_pix, conta_bancaria_id");

  if (operadoraId) {
    query = query.eq("id", operadoraId);
  } else {
    if (!unidadeId) return null;
    query = query.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`).eq("ativo", true);
  }

  const { data } = await query.limit(operadoraId ? 1 : 20);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const nomePadrao = getOperadoraPadrao(tipo);
  const selected = !operadoraId && nomePadrao
    ? rows.find((row: any) => matchesNomePadrao(row.nome, nomePadrao)) || rows[0]
    : rows[0];
  const dataRow = selected;
  if (!dataRow) return null;

  let taxa = 0;
  let prazo = 0;
  if (tipo === "pix_maquininha") {
    taxa = Number((dataRow as any).taxa_pix) || 0;
    prazo = prazoOperadoraD0({ nome: dataRow.nome, prazoCadastro: (dataRow as any).prazo_pix, prazoPadrao: 0 });
  } else if (tipo === "cartao_debito" || tipo === "debito") {
    taxa = Number(dataRow.taxa_debito) || 0;
    prazo = prazoOperadoraD0({ nome: dataRow.nome, prazoCadastro: dataRow.prazo_debito, prazoPadrao: 1 });
  } else {
    taxa = parcelas > 1 ? Number(dataRow.taxa_credito_parcelado) || 0 : Number(dataRow.taxa_credito_vista) || 0;
    prazo = prazoOperadoraD0({ nome: dataRow.nome, prazoCadastro: dataRow.prazo_credito, prazoPadrao: 30 });
  }

  return { id: dataRow.id, nome: dataRow.nome, taxa, prazo, conta_bancaria_id: (dataRow as any).conta_bancaria_id as string | null };
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
          resolverContaDestino({
            unidadeId,
            forma: "pix",
            contaExplicita: pag.conta_bancaria_id,
          }).then(contaId => {
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
        // Cartões e PIX Maquininha → contas_receber da operadora com prazo D+N.
        // D+0 com conta destino: nasce já recebido + crédito imediato no banco da operadora.
        // D+N: cron diário liquida no vencimento.
        promises.push(
          (async () => {
            const formaNorm = pag.forma === "debito" ? "cartao_debito"
              : pag.forma === "credito" ? "cartao_credito" : pag.forma;
            const parcelas = formaNorm === "cartao_credito" ? Math.max(1, Number(pag.parcelas) || 1) : 1;
            const op = await getOperadoraConfig(unidadeId || null, pag.forma, pag.operadora_id, parcelas);
            const taxaBase = op ? op.taxa : 0;
            const taxaParcelamento = formaNorm === "cartao_credito" ? Math.max(0, Number(pag.taxa_desconto_percentual) || 0) : 0;
            const taxaTotalInformada = formaNorm === "cartao_credito" ? Math.max(0, Number(pag.taxa_total_percentual) || 0) : 0;
            const taxa = taxaTotalInformada > 0 ? taxaTotalInformada : taxaBase + taxaParcelamento;
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

            const liquidaAgora = prazo === 0 && !!contaDestino;
            const vencimento = format(addDays(new Date(), prazo), "yyyy-MM-dd");
            const descricaoParcelas = formaNorm === "cartao_credito" && parcelas > 1 ? ` ${parcelas}x` : "";

            await insertContasReceber({
              cliente: op?.nome || clienteNome || "Operadora Cartão",
              descricao: `${tipoLabel}${descricaoParcelas} - Venda #${pedidoRef}`,
              valor: pag.valor,
              vencimento,
              status: liquidaAgora ? "recebida" : "pendente",
              data_recebimento: liquidaAgora ? hoje : null,
              forma_pagamento: formaNorm,
              pedido_id: pedidoId,
              unidade_id: unidadeId || null,
              operadora_id: op?.id || null,
              taxa_percentual: taxa,
              valor_taxa: valorTaxa,
              valor_liquido: valorLiquido,
              parcela_atual: 1,
              total_parcelas: parcelas,
              cliente_id: clienteId || null,
              conta_bancaria_destino_id: contaDestino,
            });

            if (liquidaAgora && contaDestino) {
              await criarMovimentacaoBancaria({
                contaBancariaId: contaDestino,
                valor: valorLiquido,
                descricao: `${tipoLabel} ${op?.nome || ""} - Venda #${pedidoRef}`.trim(),
                categoria: "liquidacao_operadora",
                unidadeId,
                userId,
                pedidoId,
              });
            }
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
        promises.push((async () => {
          const contaDestino = await resolverContaDestino({ unidadeId, forma: "fiado", contaExplicita: pag.conta_bancaria_id });
          await insertContasReceber({
            cliente: clienteNome || "Cliente não identificado",
            descricao: `Venda a prazo (Fiado) - Pedido #${pedidoRef}`,
            valor: pag.valor,
            vencimento,
            status: "pendente",
            forma_pagamento: "fiado",
            pedido_id: pedidoId,
            unidade_id: unidadeId || null,
            cliente_id: clienteId || null,
            conta_bancaria_destino_id: contaDestino,
          });
        })());
        break;
      }

      case "boleto": {
        promises.push((async () => {
          const contaDestino = await resolverContaDestino({ unidadeId, forma: "boleto", contaExplicita: pag.conta_bancaria_id });
          await insertContasReceber({
            cliente: clienteNome || "Cliente não identificado",
            descricao: `Boleto - Venda #${pedidoRef}`,
            valor: pag.valor,
            vencimento: format(addDays(new Date(), 30), "yyyy-MM-dd"),
            status: "pendente",
            forma_pagamento: "boleto",
            pedido_id: pedidoId,
            unidade_id: unidadeId || null,
            cliente_id: clienteId || null,
            conta_bancaria_destino_id: contaDestino,
          });
        })());
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
        // Programa Gás do Povo (governo): recebível D+2 (ou prazo da operadora), taxa 0%.
        // Nasce pendente; cron liquida no vencimento creditando o banco da operadora
        // (tipicamente Caixa Econômica cadastrada em operadoras_cartao.conta_bancaria_id).
        promises.push((async () => {
          const op = await getOperadoraConfig(unidadeId || null, "gas_do_povo", (pag as any).operadora_id);
          const prazo = op?.prazo ?? 2;
          const dataPrevista = format(addDays(new Date(), prazo), "yyyy-MM-dd");
          const contaDestino = await resolverContaDestino({
            unidadeId,
            forma: "gas_do_povo",
            contaExplicita: pag.conta_bancaria_id,
            operadoraContaId: op?.conta_bancaria_id || null,
          });
          const liquidaAgora = prazo === 0 && !!contaDestino;

          await insertContasReceber({
            cliente: op?.nome || "Programa Gás do Povo",
            descricao: `Gás do Povo - Venda #${pedidoRef}`,
            valor: pag.valor,
            vencimento: dataPrevista,
            status: liquidaAgora ? "recebida" : "pendente",
            data_recebimento: liquidaAgora ? hoje : null,
            forma_pagamento: "gas_do_povo",
            pedido_id: pedidoId,
            unidade_id: unidadeId || null,
            operadora_id: op?.id || null,
            taxa_percentual: 0,
            valor_taxa: 0,
            valor_liquido: pag.valor,
            cliente_id: clienteId || null,
            conta_bancaria_destino_id: contaDestino,
          });

          if (liquidaAgora && contaDestino) {
            await criarMovimentacaoBancaria({
              contaBancariaId: contaDestino,
              valor: pag.valor,
              descricao: `Gás do Povo ${op?.nome || ""} - Venda #${pedidoRef}`.trim(),
              categoria: "liquidacao_operadora",
              unidadeId,
              userId,
              pedidoId,
            });
          }
        })());
        break;
      }

      default: {
        // Formas customizadas cadastradas em Financeiro → Formas de Pagamento
        if (pag.forma?.startsWith("custom_avista_")) {
          // À vista: se houver conta bancária destino (custom.conta ou config), credita direto.
          // Caso contrário, entra no caixa da loja.
          promises.push((async () => {
            const { data: custom } = await (supabase as any)
              .from("formas_pagamento_custom")
              .select("nome")
              .eq("slug", pag.forma)
              .maybeSingle();
            const nome = custom?.nome || "Personalizado";
            const contaId = await resolverContaDestino({
              unidadeId,
              forma: pag.forma,
              contaExplicita: pag.conta_bancaria_id,
            });
            // Só credita banco se a conta veio de custom ou config (não do fallback "primeira ativa").
            // Para saber, resolvemos de novo sem fallback usando lookup direto:
            const { data: cfg } = unidadeId ? await supabase
              .from("config_destino_pagamento")
              .select("conta_bancaria_id, ativo")
              .eq("unidade_id", unidadeId)
              .eq("forma_pagamento", pag.forma)
              .maybeSingle() : { data: null } as any;
            const { data: customConta } = await (supabase as any)
              .from("formas_pagamento_custom")
              .select("conta_bancaria_id")
              .eq("slug", pag.forma)
              .maybeSingle();
            const temDestinoExplicito = !!(pag.conta_bancaria_id || customConta?.conta_bancaria_id || (cfg?.ativo !== false && cfg?.conta_bancaria_id));

            if (contaId && temDestinoExplicito) {
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
            const contaDestino = await resolverContaDestino({
              unidadeId,
              forma: pag.forma,
              contaExplicita: pag.conta_bancaria_id,
            });
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
              conta_bancaria_destino_id: contaDestino,
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

/**
 * Remove todas as movimentações financeiras vinculadas a um pedido e recria
 * a partir da lista de pagamentos fornecida. Útil quando o usuário edita a
 * forma de pagamento de um pedido já entregue/pago.
 *
 * Apaga:
 *  - movimentacoes_caixa (pedido_id = pedidoId)
 *  - movimentacoes_bancarias (referencia_id = pedidoId AND referencia_tipo = 'pedido')
 *  - contas_receber (pedido_id = pedidoId AND status NOT IN ('recebida','recebido','conciliada'))
 *  - cheques (pedido_id = pedidoId AND status = 'pendente')
 * E então chama `rotearPagamentosVenda`.
 */
export async function rerotearPagamentosPedido(
  params: RotearPagamentosParams
): Promise<void> {
  const { pedidoId } = params;

  await Promise.all([
    supabase.from("movimentacoes_caixa").delete().eq("pedido_id", pedidoId),
    supabase
      .from("movimentacoes_bancarias")
      .delete()
      .eq("referencia_id", pedidoId)
      .eq("referencia_tipo", "pedido"),
    supabase
      .from("contas_receber")
      .delete()
      .eq("pedido_id", pedidoId)
      .not("status", "in", "(recebida,recebido,conciliada)"),
    supabase.from("cheques").delete().eq("pedido_id", pedidoId).eq("status", "pendente"),
  ]);

  await rotearPagamentosVenda(params);
}
