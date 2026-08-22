import { supabase } from "@/integrations/supabase/client";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  calcularPrecoMedioCompraPorProduto,
  classificarDespesaDRE,
  criarMapaCategoriasFiscais,
} from "./dreFinanceiro";
import { isDespesaOperacionalResultado } from "./despesasResultado";

/**
 * Regras da DRE (regime de competência) — fonte única de verdade.
 *
 * 1. Receita: apenas pedidos entregues/finalizados/pagos, pela data operacional.
 *    Pedidos cancelados nunca entram.
 * 2. CMV: quantidade vendida de cada produto x preco medio ponderado de compra.
 *    Compras do mês NÃO viram custo — viram estoque.
 * 3. Despesas: cada gasto entra uma única vez. Pagamentos de compras/contas a pagar
 *    são liquidação financeira, não despesa.
 * 4. Impostos: somente os efetivamente lançados (sem percentual fixo).
 * 5. Período: sempre pela data do fato, nunca pela data do pagamento.
 */

export { STATUS_RECEITA_DRE, mesRangeDre, filtroPeriodoPedidos } from "./dreRange";

const getDataOperacionalPedido = (pedido: { data_entrega?: string | null; created_at?: string | null }) =>
  (pedido.data_entrega || pedido.created_at || "").slice(0, 10);

export type DreGrupo =
  | "receita"
  | "impostos"
  | "cmv"
  | "pessoal"
  | "operacional"
  | "administrativa"
  | "financeira";

export interface DreLancamento {
  data: string;
  descricao: string;
  origem: string;
  valor: number;
}

export interface DreProdutoVendido {
  produto_id: string;
  nome: string;
  quantidade: number;
  receita: number;
  custoUnitario: number;
  custoTotal: number;
  semCusto: boolean;
}

export interface DreMes {
  key: string;
  label: string;
  inicio: string;
  fim: string;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  cmv: number;
  lucroBruto: number;
  despPessoal: number;
  despOperacional: number;
  despAdministrativa: number;
  resultadoOperacional: number;
  despFinanceira: number;
  resultadoLiquido: number;
  qtdPedidos: number;
  qtdCancelados: number;
  comprasNaoPagas: number;
  produtos: DreProdutoVendido[];
  detalhes: Record<DreGrupo, DreLancamento[]>;
  avisos: string[];
}

const NOMES_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const norm = (v?: string | null) =>
  (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Movimentações que só transferem dinheiro entre contas próprias. */
const isTransferenciaInterna = (categoria?: string | null, descricao?: string | null) => {
  const t = `${norm(categoria)} ${norm(descricao)}`;
  return (
    t.includes("deposito banc") ||
    t.includes("transferencia caixa") ||
    t.includes("transferencia entre contas") ||
    t.includes("sangria") ||
    t.includes("suprimento de caixa")
  );
};

/** Gastos ligados a compra de mercadoria — já refletidos no estoque/CMV. */
const isCompraMercadoria = (categoria?: string | null, descricao?: string | null) => {
  const t = `${norm(categoria)} ${norm(descricao)}`;
  return (
    t.includes("compra") ||
    t.includes("mercadoria") ||
    t.includes("estoque") ||
    t.includes("fornecedor")
  );
};

/** Saída que apenas quita um título já reconhecido como despesa/custo. */
const isLiquidacaoTitulo = (categoria?: string | null, descricao?: string | null, referenciaTipo?: string | null) => {
  const t = `${norm(categoria)} ${norm(descricao)}`;
  const ref = norm(referenciaTipo);
  return (
    ref.includes("conta_pagar") ||
    ref.includes("contas_pagar") ||
    ref.includes("compra") ||
    t.includes("contas_pagar") ||
    t.includes("contas a pagar") ||
    t.startsWith("pagto") ||
    t.includes("pagto ") ||
    t.includes("pagamento de compra")
  );
};

const isImposto = (categoria?: string | null, descricao?: string | null) => {
  const t = `${norm(categoria)} ${norm(descricao)}`;
  return (
    t.includes("imposto") ||
    t.includes("tributo") ||
    t.includes("simples nacional") ||
    t.includes("icms") ||
    t.includes("pis") ||
    t.includes("cofins") ||
    t.includes(" das ") ||
    t === "das" ||
    t.includes("iss")
  );
};

const classificarDespesa = (categoria?: string | null, descricao?: string | null): DreGrupo => {
  const t = `${norm(categoria)} ${norm(descricao)}`;
  if (isImposto(categoria, descricao)) return "impostos";
  if (t.includes("pessoal") || t.includes("salario") || t.includes("folha") || t.includes("comiss") || t.includes("vale transporte") || t.includes("ferias") || t.includes("rescis"))
    return "pessoal";
  if (t.includes("financ") || t.includes("juros") || t.includes("tarifa") || t.includes("multa") || t.includes("emprestimo") || t.includes("taxa banc"))
    return "financeira";
  if (t.includes("admin") || t.includes("escrit") || t.includes("contab") || t.includes("aluguel") || t.includes("agua") || t.includes("energia") || t.includes("internet") || t.includes("telefone"))
    return "administrativa";
  return "operacional";
};

const vazioDetalhes = (): Record<DreGrupo, DreLancamento[]> => ({
  receita: [],
  impostos: [],
  cmv: [],
  pessoal: [],
  operacional: [],
  administrativa: [],
  financeira: [],
});

async function calcularMes(referencia: Date, unidadeId?: string): Promise<DreMes> {
  const inicioDate = format(startOfMonth(referencia), "yyyy-MM-dd");
  const fimDate = format(endOfMonth(referencia), "yyyy-MM-dd");
  const inicioISO = startOfMonth(referencia).toISOString();
  const fimISO = endOfMonth(referencia).toISOString();

  let pq = supabase
    .from("pedidos")
    .select("id, valor_total, data_entrega, created_at, status, numero_pedido")
    .in("status", STATUS_RECEITA_DRE)
    .or(`and(data_entrega.gte.${inicioDate},data_entrega.lte.${fimDate}),and(data_entrega.is.null,created_at.gte.${inicioISO},created_at.lte.${fimISO})`);
  if (unidadeId) pq = pq.eq("unidade_id", unidadeId);

  let cancQ = supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("status", "cancelado")
    .gte("created_at", inicioISO)
    .lte("created_at", fimISO);
  if (unidadeId) cancQ = cancQ.eq("unidade_id", unidadeId);

  let caixaQ = supabase
    .from("movimentacoes_caixa")
    .select("valor, categoria, descricao, status, created_at")
    .eq("tipo", "saida")
    .or("status.is.null,status.neq.rejeitada")
    .is("compra_id", null)
    .is("pedido_id", null)
    .gte("created_at", inicioISO)
    .lte("created_at", fimISO);
  if (unidadeId) caixaQ = caixaQ.eq("unidade_id", unidadeId);

  let bancoQ = supabase
    .from("movimentacoes_bancarias")
    .select("valor, categoria, descricao, data, referencia_tipo")
    .eq("tipo", "saida")
    .gte("data", inicioDate)
    .lte("data", fimDate);
  if (unidadeId) bancoQ = bancoQ.eq("unidade_id", unidadeId);

  let cpQ = supabase
    .from("contas_pagar")
    .select("valor, categoria, descricao, vencimento, compra_id")
    .gte("vencimento", inicioDate)
    .lte("vencimento", fimDate);
  if (unidadeId) cpQ = cpQ.eq("unidade_id", unidadeId);

  let dcQ = supabase
    .from("despesas_contabeis")
    .select("valor, categoria, descricao, data_despesa")
    .gte("data_despesa", inicioDate)
    .lte("data_despesa", fimDate);
  if (unidadeId) dcQ = dcQ.eq("unidade_id", unidadeId);

  let compQ = supabase
    .from("compras")
    .select("valor_total, pago, data_compra")
    .eq("pago", false)
    .gte("data_compra", inicioDate)
    .lte("data_compra", fimDate);
  if (unidadeId) compQ = compQ.eq("unidade_id", unidadeId);

  let categoriasQ = supabase
    .from("categorias_despesa")
    .select("nome, grupo")
    .eq("ativo", true);
  if (unidadeId) categoriasQ = categoriasQ.or(`unidade_id.is.null,unidade_id.eq.${unidadeId}`);

  const [
    { data: pedidos },
    { count: qtdCancelados },
    { data: caixa },
    { data: banco },
    { data: contasPagar },
    { data: despesasContabeis },
    { data: comprasAbertas },
    { data: categoriasFiscais },
  ] = await Promise.all([pq, cancQ, caixaQ, bancoQ, cpQ, dcQ, compQ, categoriasQ]);
  const mapaCategoriasFiscais = criarMapaCategoriasFiscais(categoriasFiscais || []);

  const detalhes = vazioDetalhes();
  const avisos: string[] = [];

  // ---------- Receita ----------
  const listaPedidos = pedidos || [];
  const receitaBruta = listaPedidos.reduce((s, p: any) => s + Number(p.valor_total || 0), 0);
  listaPedidos.forEach((p: any) => {
    detalhes.receita.push({
      data: getDataOperacionalPedido(p),
      descricao: `Pedido #${p.numero_pedido ?? "—"}`,
      origem: "Pedidos",
      valor: Number(p.valor_total || 0),
    });
  });

  // ---------- CMV: custo do que foi vendido ----------
  const pedidoIds = listaPedidos.map((p: any) => p.id);
  const produtosMap = new Map<string, DreProdutoVendido>();

  if (pedidoIds.length > 0) {
    const itens: any[] = [];
    for (let i = 0; i < pedidoIds.length; i += 300) {
      const { data } = await supabase
        .from("pedido_itens")
        .select("produto_id, quantidade, preco_unitario")
        .in("pedido_id", pedidoIds.slice(i, i + 300));
      itens.push(...(data || []));
    }

    const ids = Array.from(new Set(itens.map((i) => i.produto_id).filter(Boolean)));
    const produtosInfo = new Map<string, { nome: string; preco_custo: number | null }>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, preco_custo")
        .in("id", ids.slice(i, i + 300));
      (data || []).forEach((p: any) => produtosInfo.set(p.id, { nome: p.nome, preco_custo: p.preco_custo }));
    }

    let comprasHistoricasQ = supabase
      .from("compras")
      .select("id, status")
      .lte("data_compra", fimDate);
    if (unidadeId) comprasHistoricasQ = comprasHistoricasQ.eq("unidade_id", unidadeId);
    const { data: comprasHistoricas } = await comprasHistoricasQ;
    const compraIds = (comprasHistoricas || [])
      .filter((c: any) => !["cancelada", "cancelado", "rejeitada", "rejeitado"].includes(String(c.status || "").toLowerCase()))
      .map((c: any) => c.id)
      .filter(Boolean);
    const itensCompra: any[] = [];
    for (let i = 0; i < compraIds.length; i += 300) {
      const { data } = await supabase
        .from("compra_itens")
        .select("produto_id, quantidade, preco_unitario")
        .in("compra_id", compraIds.slice(i, i + 300));
      itensCompra.push(...(data || []));
    }
    const custoMedioCompra = calcularPrecoMedioCompraPorProduto(itensCompra);

    itens.forEach((item) => {
      if (!item.produto_id) return;
      const info = produtosInfo.get(item.produto_id);
      const qtd = Number(item.quantidade || 0);
      const custoMedio = custoMedioCompra.get(item.produto_id);
      const custoUnit = custoMedio ?? Number(info?.preco_custo || 0);
      const atual = produtosMap.get(item.produto_id) || {
        produto_id: item.produto_id,
        nome: info?.nome || "Produto removido",
        quantidade: 0,
        receita: 0,
        custoUnitario: custoUnit,
        custoTotal: 0,
        semCusto: custoMedio == null && !info?.preco_custo,
      };
      atual.quantidade += qtd;
      atual.receita += qtd * Number(item.preco_unitario || 0);
      atual.custoTotal += qtd * custoUnit;
      produtosMap.set(item.produto_id, atual);
    });
  }

  const produtos = Array.from(produtosMap.values()).sort((a, b) => b.quantidade - a.quantidade);
  const cmv = produtos.reduce((s, p) => s + p.custoTotal, 0);
  produtos.forEach((p) => {
    if (p.custoTotal > 0) {
      detalhes.cmv.push({
        data: fimDate,
        descricao: `${p.nome} — ${p.quantidade.toLocaleString("pt-BR")} un x ${p.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        origem: "Custo medio do vendido",
        valor: p.custoTotal,
      });
    }
  });

  const semCusto = produtos.filter((p) => p.semCusto && p.quantidade > 0);
  if (semCusto.length > 0) {
    avisos.push(
      `${semCusto.length} produto(s) vendidos sem preço de custo cadastrado (${semCusto
        .slice(0, 3)
        .map((p) => p.nome)
        .join(", ")}) — o CMV está subestimado.`
    );
  }

  // ---------- Despesas (cada gasto uma única vez) ----------
  type Bruto = { data: string; descricao: string; categoria?: string | null; status?: string | null; valor: number; origem: string; referenciaTipo?: string | null; ehLiquidacao?: boolean };

  const brutos: Bruto[] = [
    ...(caixa || []).map((d: any) => ({
      data: String(d.created_at).slice(0, 10),
      descricao: d.descricao || d.categoria || "Despesa de caixa",
      categoria: d.categoria,
      status: d.status,
      valor: Number(d.valor || 0),
      origem: "Caixa",
    })),
    ...(banco || []).map((d: any) => ({
      data: d.data,
      descricao: d.descricao || d.categoria || "Saída bancária",
      categoria: d.categoria,
      valor: Number(d.valor || 0),
      origem: "Banco",
      referenciaTipo: d.referencia_tipo,
      ehLiquidacao: true,
    })),
    ...(contasPagar || [])
      .filter((d: any) => !d.compra_id)
      .map((d: any) => ({
        data: d.vencimento,
        descricao: d.descricao || d.categoria || "Conta a pagar",
        categoria: d.categoria,
        valor: Number(d.valor || 0),
        origem: "Contas a pagar",
      })),
    ...(despesasContabeis || []).map((d: any) => ({
      data: d.data_despesa,
      descricao: d.descricao || d.categoria || "Despesa contábil",
      categoria: d.categoria,
      valor: Number(d.valor || 0),
      origem: "Despesas contábeis",
    })),
  ];

  let semCategoria = 0;

  brutos.forEach((d) => {
    if (!d.valor) return;
    if (!isDespesaOperacionalResultado({ categoria: d.categoria, descricao: d.descricao, referenciaTipo: d.referenciaTipo, status: d.status })) return;
    if (isTransferenciaInterna(d.categoria, d.descricao)) return;
    if (isCompraMercadoria(d.categoria, d.descricao)) return;
    // saída bancária que apenas quita título já reconhecido
    if (d.ehLiquidacao && isLiquidacaoTitulo(d.categoria, d.descricao, d.referenciaTipo)) return;
    if (!d.categoria) semCategoria += 1;

    const grupoFiscal = classificarDespesaDRE(d.categoria || d.descricao, mapaCategoriasFiscais);
    if (grupoFiscal === "mercadorias") return;
    const grupo: DreGrupo =
      grupoFiscal === "administrativo" ? "administrativa" :
      grupoFiscal === "financeiro" ? "financeira" :
      grupoFiscal;
    detalhes[grupo].push({ data: d.data, descricao: d.descricao, origem: d.origem, valor: d.valor });
  });

  if (semCategoria > 0) {
    avisos.push(`${semCategoria} lançamento(s) sem categoria foram classificados como despesa operacional.`);
  }

  const soma = (g: DreGrupo) => detalhes[g].reduce((s, l) => s + l.valor, 0);

  const impostos = soma("impostos");
  const despPessoal = soma("pessoal");
  const despOperacional = soma("operacional");
  const despAdministrativa = soma("administrativa");
  const despFinanceira = soma("financeira");

  const receitaLiquida = receitaBruta - impostos;
  const lucroBruto = receitaLiquida - cmv;
  const resultadoOperacional = lucroBruto - despPessoal - despOperacional - despAdministrativa;
  const resultadoLiquido = resultadoOperacional - despFinanceira;

  const comprasNaoPagas = (comprasAbertas || []).reduce((s: number, c: any) => s + Number(c.valor_total || 0), 0);
  if (comprasNaoPagas > 0) {
    avisos.push(
      `${comprasNaoPagas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em compras do mês ainda não pagas (informativo — não afeta o resultado).`
    );
  }

  Object.values(detalhes).forEach((lista) => lista.sort((a, b) => (a.data < b.data ? -1 : 1)));

  return {
    key: format(referencia, "yyyy-MM"),
    label: `${NOMES_MESES[referencia.getMonth()]}/${String(referencia.getFullYear()).slice(2)}`,
    inicio: inicioDate,
    fim: fimDate,
    receitaBruta,
    impostos,
    receitaLiquida,
    cmv,
    lucroBruto,
    despPessoal,
    despOperacional,
    despAdministrativa,
    resultadoOperacional,
    despFinanceira,
    resultadoLiquido,
    qtdPedidos: listaPedidos.length,
    qtdCancelados: qtdCancelados || 0,
    comprasNaoPagas,
    produtos,
    detalhes,
    avisos,
  };
}

export async function calcularDRE(referencia: Date, qtdMeses: number, unidadeId?: string): Promise<DreMes[]> {
  const datas: Date[] = [];
  for (let i = qtdMeses - 1; i >= 0; i--) {
    datas.push(new Date(referencia.getFullYear(), referencia.getMonth() - i, 1));
  }
  const resultados: DreMes[] = [];
  for (const d of datas) {
    resultados.push(await calcularMes(d, unidadeId));
  }
  return resultados;
}

export interface DreLinhaConfig {
  categoria: string;
  tipo: "receita" | "deducao" | "subtotal" | "custo" | "despesa" | "resultado";
  grupo?: DreGrupo;
  campo: keyof DreMes;
  negativo?: boolean;
  indent?: boolean;
  ajuda?: string;
}

export const DRE_LINHAS: DreLinhaConfig[] = [
  { categoria: "Receita Bruta de Vendas", tipo: "receita", grupo: "receita", campo: "receitaBruta", ajuda: "Pedidos entregues/finalizados/pagos no mês, pela data de entrega ou criação. Cancelados não entram." },
  { categoria: "(-) Impostos e deduções", tipo: "deducao", grupo: "impostos", campo: "impostos", negativo: true, indent: true, ajuda: "Somente impostos efetivamente lançados. Sem percentual estimado." },
  { categoria: "RECEITA LÍQUIDA", tipo: "subtotal", campo: "receitaLiquida" },
  { categoria: "(-) CMV — custo dos produtos vendidos", tipo: "custo", grupo: "cmv", campo: "cmv", negativo: true, indent: true, ajuda: "Quantidade vendida x preco medio ponderado de compra do produto. Compras do mes viram estoque, nao custo integral." },
  { categoria: "LUCRO BRUTO", tipo: "subtotal", campo: "lucroBruto" },
  { categoria: "(-) Despesas com Pessoal", tipo: "despesa", grupo: "pessoal", campo: "despPessoal", negativo: true, indent: true },
  { categoria: "(-) Despesas Operacionais", tipo: "despesa", grupo: "operacional", campo: "despOperacional", negativo: true, indent: true },
  { categoria: "(-) Despesas Administrativas", tipo: "despesa", grupo: "administrativa", campo: "despAdministrativa", negativo: true, indent: true },
  { categoria: "RESULTADO OPERACIONAL", tipo: "subtotal", campo: "resultadoOperacional" },
  { categoria: "(-) Despesas Financeiras", tipo: "despesa", grupo: "financeira", campo: "despFinanceira", negativo: true, indent: true },
  { categoria: "RESULTADO LÍQUIDO", tipo: "resultado", campo: "resultadoLiquido" },
];
