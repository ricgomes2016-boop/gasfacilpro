import { describe, expect, it } from "vitest";
import type { DreMes } from "./dreCalculo";
import {
  agregarProdutos,
  agruparPorOrigem,
  consolidarDre,
  construirPonte,
  lancamentosParaCsv,
  margemLiquida,
  percentualReceita,
  variacaoPercentual,
} from "./dreView";

const mes = (over: Partial<DreMes>): DreMes => ({
  key: "2026-01",
  label: "Jan/26",
  inicio: "2026-01-01",
  fim: "2026-01-31",
  receitaBruta: 0,
  impostos: 0,
  receitaLiquida: 0,
  cmv: 0,
  lucroBruto: 0,
  despPessoal: 0,
  despOperacional: 0,
  despAdministrativa: 0,
  resultadoOperacional: 0,
  despFinanceira: 0,
  resultadoLiquido: 0,
  qtdPedidos: 0,
  qtdCancelados: 0,
  comprasNaoPagas: 0,
  produtos: [],
  detalhes: { receita: [], impostos: [], cmv: [], pessoal: [], operacional: [], administrativa: [], financeira: [] },
  avisos: [],
  ...over,
});

describe("dreView", () => {
  it("consolida meses campo a campo", () => {
    const t = consolidarDre([
      mes({ receitaBruta: 100, cmv: 40, resultadoLiquido: 20, qtdPedidos: 3 }),
      mes({ receitaBruta: 200, cmv: 60, resultadoLiquido: -10, qtdPedidos: 5 }),
    ]);
    expect(t.receitaBruta).toBe(300);
    expect(t.cmv).toBe(100);
    expect(t.resultadoLiquido).toBe(10);
    expect(t.qtdPedidos).toBe(8);
  });

  it("consolida vazio como zeros", () => {
    expect(consolidarDre([]).receitaBruta).toBe(0);
  });

  it("nao inventa variacao quando nao ha base anterior", () => {
    expect(variacaoPercentual(100, 0)).toBeNull();
    expect(variacaoPercentual(100, 50)).toBe(100);
    expect(variacaoPercentual(-50, -100)).toBeCloseTo(50);
  });

  it("percentual da receita liquida retorna null sem receita", () => {
    expect(percentualReceita(10, 0)).toBeNull();
    expect(percentualReceita(25, 100)).toBe(25);
  });

  it("margem liquida usa receita liquida", () => {
    const t = consolidarDre([mes({ receitaLiquida: 1000, resultadoLiquido: 120 })]);
    expect(margemLiquida(t)).toBeCloseTo(12);
    expect(margemLiquida(consolidarDre([]))).toBeNull();
  });

  it("agrega produtos por receita com margem e custo medio", () => {
    const produtos = agregarProdutos([
      mes({ produtos: [{ produto_id: "p13", nome: "Gás P13", quantidade: 10, receita: 1200, custoUnitario: 90, custoTotal: 900, semCusto: false }] }),
      mes({ produtos: [{ produto_id: "p13", nome: "Gás P13", quantidade: 5, receita: 600, custoUnitario: 100, custoTotal: 500, semCusto: true }] }),
    ]);
    expect(produtos).toHaveLength(1);
    expect(produtos[0].quantidade).toBe(15);
    expect(produtos[0].receita).toBe(1800);
    expect(produtos[0].custoTotal).toBe(1400);
    expect(produtos[0].custoUnitario).toBeCloseTo(93.333, 2);
    expect(produtos[0].lucroBruto).toBe(400);
    expect(produtos[0].margem).toBeCloseTo(22.22, 1);
    expect(produtos[0].semCusto).toBe(true);
  });

  it("monta a ponte do resultado com deducoes negativas", () => {
    const ponte = construirPonte(consolidarDre([mes({ receitaBruta: 1000, impostos: 100, receitaLiquida: 900, cmv: 400, lucroBruto: 500, despPessoal: 200, resultadoLiquido: 300 })]));
    expect(ponte[0]).toEqual({ label: "Receita Bruta", valor: 1000, tipo: "base" });
    expect(ponte[1].valor).toBe(-100);
    expect(ponte[ponte.length - 1]).toEqual({ label: "Resultado Líquido", valor: 300, tipo: "resultado" });
  });

  it("agrupa lancamentos por origem", () => {
    const grupos = agruparPorOrigem([
      { data: "2026-01-02", descricao: "a", origem: "Caixa", valor: 10 },
      { data: "2026-01-03", descricao: "b", origem: "Caixa", valor: 20 },
      { data: "2026-01-04", descricao: "c", origem: "Banco", valor: 50 },
    ]);
    expect(grupos[0]).toEqual({ origem: "Banco", quantidade: 1, total: 50 });
    expect(grupos[1]).toEqual({ origem: "Caixa", quantidade: 2, total: 30 });
  });

  it("gera CSV com data pt-BR e virgula decimal", () => {
    const csv = lancamentosParaCsv([{ data: "2026-01-02", descricao: 'Conta "luz"', origem: "Caixa", valor: 1234.5 }]);
    const linhas = csv.split("\n");
    expect(linhas[0]).toBe('"Data";"Descrição";"Origem";"Valor"');
    expect(linhas[1]).toBe('"02/01/2026";"Conta ""luz""";"Caixa";"1234,50"');
  });
});
