import type { DreLancamento, DreMes, DreProdutoVendido } from "./dreCalculo";

/**
 * Helpers puros de apresentação da DRE.
 * Nenhuma regra de cálculo contábil nova: apenas consolidação, comparação
 * e formatação das saídas já produzidas por `calcularDRE`.
 */

export interface DreTotais {
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
}

const CAMPOS: (keyof DreTotais)[] = [
  "receitaBruta",
  "impostos",
  "receitaLiquida",
  "cmv",
  "lucroBruto",
  "despPessoal",
  "despOperacional",
  "despAdministrativa",
  "resultadoOperacional",
  "despFinanceira",
  "resultadoLiquido",
  "qtdPedidos",
  "qtdCancelados",
  "comprasNaoPagas",
];

/** Soma os meses informados campo a campo. Sem meses, devolve tudo zerado. */
export function consolidarDre(meses: DreMes[]): DreTotais {
  const base = Object.fromEntries(CAMPOS.map((c) => [c, 0])) as unknown as DreTotais;
  meses.forEach((m) => {
    CAMPOS.forEach((c) => {
      base[c] += Number((m as unknown as Record<string, number>)[c] || 0);
    });
  });
  return base;
}

/**
 * Variação percentual entre dois períodos.
 * Retorna `null` quando não há base válida de comparação — nunca 0% enganoso.
 */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Percentual sobre a Receita Líquida. `null` quando não há receita medida. */
export function percentualReceita(valor: number, receitaLiquida: number): number | null {
  if (!Number.isFinite(valor) || !Number.isFinite(receitaLiquida) || receitaLiquida === 0) return null;
  return (valor / receitaLiquida) * 100;
}

/** Margem líquida do período. `null` quando não há receita líquida. */
export function margemLiquida(totais: DreTotais): number | null {
  return percentualReceita(totais.resultadoLiquido, totais.receitaLiquida);
}

export interface ProdutoAgregado extends Omit<DreProdutoVendido, "custoUnitario"> {
  custoUnitario: number;
  lucroBruto: number;
  margem: number | null;
}

/** Consolida os produtos vendidos dos meses selecionados, ordenados por receita. */
export function agregarProdutos(meses: DreMes[]): ProdutoAgregado[] {
  const map = new Map<string, ProdutoAgregado>();
  meses.forEach((m) =>
    m.produtos.forEach((p) => {
      const atual =
        map.get(p.produto_id) ||
        ({
          produto_id: p.produto_id,
          nome: p.nome,
          quantidade: 0,
          receita: 0,
          custoTotal: 0,
          custoUnitario: 0,
          semCusto: false,
          lucroBruto: 0,
          margem: null,
        } as ProdutoAgregado);
      atual.quantidade += p.quantidade;
      atual.receita += p.receita;
      atual.custoTotal += p.custoTotal;
      atual.semCusto = atual.semCusto || p.semCusto;
      map.set(p.produto_id, atual);
    }),
  );

  return Array.from(map.values())
    .map((p) => ({
      ...p,
      custoUnitario: p.quantidade > 0 ? p.custoTotal / p.quantidade : 0,
      lucroBruto: p.receita - p.custoTotal,
      margem: p.receita > 0 ? ((p.receita - p.custoTotal) / p.receita) * 100 : null,
    }))
    .sort((a, b) => b.receita - a.receita);
}

export interface PonteEtapa {
  label: string;
  valor: number;
  tipo: "base" | "reducao" | "subtotal" | "resultado";
}

/** Ponte do resultado (waterfall): Receita Bruta → ... → Resultado Líquido. */
export function construirPonte(t: DreTotais): PonteEtapa[] {
  return [
    { label: "Receita Bruta", valor: t.receitaBruta, tipo: "base" },
    { label: "Impostos", valor: -t.impostos, tipo: "reducao" },
    { label: "Receita Líquida", valor: t.receitaLiquida, tipo: "subtotal" },
    { label: "CMV", valor: -t.cmv, tipo: "reducao" },
    { label: "Lucro Bruto", valor: t.lucroBruto, tipo: "subtotal" },
    { label: "Pessoal", valor: -t.despPessoal, tipo: "reducao" },
    { label: "Operacionais", valor: -t.despOperacional, tipo: "reducao" },
    { label: "Administrativas", valor: -t.despAdministrativa, tipo: "reducao" },
    { label: "Financeiras", valor: -t.despFinanceira, tipo: "reducao" },
    { label: "Resultado Líquido", valor: t.resultadoLiquido, tipo: "resultado" },
  ];
}

/** Contagem e total por origem dos lançamentos de uma linha. */
export function agruparPorOrigem(lancamentos: DreLancamento[]): { origem: string; quantidade: number; total: number }[] {
  const map = new Map<string, { origem: string; quantidade: number; total: number }>();
  lancamentos.forEach((l) => {
    const atual = map.get(l.origem) || { origem: l.origem, quantidade: 0, total: 0 };
    atual.quantidade += 1;
    atual.total += Number(l.valor || 0);
    map.set(l.origem, atual);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** CSV local (ponto e vírgula, padrão pt-BR) dos lançamentos de uma linha. */
export function lancamentosParaCsv(lancamentos: DreLancamento[]): string {
  const linhas = [["Data", "Descrição", "Origem", "Valor"].map(csvCell).join(";")];
  lancamentos.forEach((l) => {
    linhas.push(
      [
        csvCell(l.data ? l.data.split("-").reverse().join("/") : ""),
        csvCell(l.descricao),
        csvCell(l.origem),
        csvCell(Number(l.valor || 0).toFixed(2).replace(".", ",")),
      ].join(";"),
    );
  });
  return linhas.join("\n");
}
