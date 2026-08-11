import { normalizeFinanceText } from "./financeiroClassificacao";

export interface VendaItemDRE {
  produto_id?: string | null;
  quantidade?: number | string | null;
  preco_unitario?: number | string | null;
  produtos?: {
    nome?: string | null;
    preco_custo?: number | string | null;
  } | null;
}

export interface CompraItemDRE {
  produto_id?: string | null;
  quantidade?: number | string | null;
  preco_unitario?: number | string | null;
}

export interface ProdutoMargemDRE {
  produtoId: string;
  nome: string;
  quantidade: number;
  receita: number;
  custo: number;
  lucroBruto: number;
  precoMedioVenda: number;
  precoMedioCompra: number;
  custoCadastrado: boolean;
}

export type GrupoDespesaDRE =
  | "operacional"
  | "administrativo"
  | "pessoal"
  | "financeiro"
  | "impostos"
  | "mercadorias";

export interface CategoriaFiscalDRE {
  nome?: string | null;
  grupo?: string | null;
}

export function calcularPrecoMedioCompraPorProduto(compraItens: CompraItemDRE[]): Map<string, number> {
  const acumulado = new Map<string, { quantidade: number; total: number }>();

  compraItens.forEach((item) => {
    if (!item.produto_id) return;
    const quantidade = Number(item.quantidade || 0);
    const precoUnitario = Number(item.preco_unitario || 0);
    if (quantidade <= 0 || precoUnitario < 0) return;

    const atual = acumulado.get(item.produto_id) || { quantidade: 0, total: 0 };
    atual.quantidade += quantidade;
    atual.total += quantidade * precoUnitario;
    acumulado.set(item.produto_id, atual);
  });

  const resultado = new Map<string, number>();
  acumulado.forEach((valor, produtoId) => {
    if (valor.quantidade > 0) resultado.set(produtoId, valor.total / valor.quantidade);
  });

  return resultado;
}

export function calcularMargemProdutos(
  vendaItens: VendaItemDRE[],
  custoMedioCompra: Map<string, number>,
): ProdutoMargemDRE[] {
  const produtos = new Map<string, ProdutoMargemDRE>();

  vendaItens.forEach((item, index) => {
    const produtoId = item.produto_id || `sem-produto-${index}`;
    const quantidade = Number(item.quantidade || 0);
    const precoVenda = Number(item.preco_unitario || 0);
    if (quantidade <= 0 || precoVenda < 0) return;

    const custoCompra = custoMedioCompra.get(produtoId);
    const precoCustoProduto = Number(item.produtos?.preco_custo || 0);
    const custoUnitario = custoCompra ?? precoCustoProduto;
    const existente = produtos.get(produtoId) || {
      produtoId,
      nome: item.produtos?.nome || "Produto sem cadastro",
      quantidade: 0,
      receita: 0,
      custo: 0,
      lucroBruto: 0,
      precoMedioVenda: 0,
      precoMedioCompra: custoUnitario,
      custoCadastrado: Boolean(custoCompra || precoCustoProduto),
    };

    existente.quantidade += quantidade;
    existente.receita += quantidade * precoVenda;
    existente.custo += quantidade * custoUnitario;
    existente.lucroBruto = existente.receita - existente.custo;
    existente.precoMedioVenda = existente.quantidade > 0 ? existente.receita / existente.quantidade : 0;
    existente.precoMedioCompra = existente.quantidade > 0 ? existente.custo / existente.quantidade : 0;
    existente.custoCadastrado = existente.custoCadastrado || Boolean(custoCompra || precoCustoProduto);
    produtos.set(produtoId, existente);
  });

  return Array.from(produtos.values());
}

export function criarMapaCategoriasFiscais(categorias: CategoriaFiscalDRE[]): Map<string, string> {
  const mapa = new Map<string, string>();
  categorias.forEach((categoria) => {
    const nome = normalizeFinanceText(categoria.nome);
    if (nome) mapa.set(nome, normalizeFinanceText(categoria.grupo));
  });
  return mapa;
}

export function classificarDespesaDRE(
  categoria: string | null | undefined,
  mapaCategorias: Map<string, string>,
): GrupoDespesaDRE {
  const texto = normalizeFinanceText(categoria);
  const grupoFiscal = mapaCategorias.get(texto);
  const grupo = grupoFiscal || texto;

  if (grupo.includes("compras_mercadorias") || grupo.includes("mercadoria") || grupo.includes("estoque")) return "mercadorias";
  if (grupo.includes("pessoal") || grupo.includes("salario") || grupo.includes("folha") || grupo.includes("comiss") || grupo.includes("labore")) return "pessoal";
  if (grupo.includes("financeiro") || grupo.includes("juros") || grupo.includes("tarifa") || grupo.includes("taxa")) return "financeiro";
  if (grupo.includes("imposto") || grupo.includes("tribut")) return "impostos";
  if (grupo.includes("administrativo") || grupo.includes("ocupacao") || grupo.includes("estrutura") || grupo.includes("contab")) return "administrativo";
  return "operacional";
}
