import { describe, expect, it } from "vitest";
import {
  calcularMargemProdutos,
  calcularPrecoMedioCompraPorProduto,
  classificarDespesaDRE,
  criarMapaCategoriasFiscais,
} from "./dreFinanceiro";

describe("dreFinanceiro", () => {
  it("calcula custo medio ponderado de compra por produto", () => {
    const custos = calcularPrecoMedioCompraPorProduto([
      { produto_id: "p13", quantidade: 10, preco_unitario: 90 },
      { produto_id: "p13", quantidade: 5, preco_unitario: 96 },
      { produto_id: "agua", quantidade: 20, preco_unitario: 8 },
    ]);

    expect(custos.get("p13")).toBeCloseTo(92);
    expect(custos.get("agua")).toBe(8);
  });

  it("calcula lucro bruto por produto vendido", () => {
    const custos = new Map([["p13", 92]]);
    const margem = calcularMargemProdutos([
      { produto_id: "p13", quantidade: 3, preco_unitario: 120, produtos: { nome: "Gas P13", preco_custo: 85 } },
    ], custos);

    expect(margem[0].receita).toBe(360);
    expect(margem[0].custo).toBe(276);
    expect(margem[0].lucroBruto).toBe(84);
    expect(margem[0].precoMedioVenda).toBe(120);
    expect(margem[0].precoMedioCompra).toBe(92);
  });

  it("classifica despesas usando categorias fiscais cadastradas", () => {
    const mapa = criarMapaCategoriasFiscais([
      { nome: "Folha entregadores", grupo: "pessoal" },
      { nome: "Taxa PagBank", grupo: "financeiro" },
      { nome: "Compra GLP", grupo: "compras_mercadorias" },
    ]);

    expect(classificarDespesaDRE("Folha entregadores", mapa)).toBe("pessoal");
    expect(classificarDespesaDRE("Taxa PagBank", mapa)).toBe("financeiro");
    expect(classificarDespesaDRE("Compra GLP", mapa)).toBe("mercadorias");
    expect(classificarDespesaDRE("Aluguel", mapa)).toBe("operacional");
  });

  it("classifica pro labore com ou sem hifen como pessoal", () => {
    const mapa = criarMapaCategoriasFiscais([{ nome: "Pro-Labore", grupo: "pessoal" }]);

    expect(classificarDespesaDRE("Pro-Labore", mapa)).toBe("pessoal");
    expect(classificarDespesaDRE("Pro Labore", mapa)).toBe("pessoal");
    expect(classificarDespesaDRE("pro labore socios", new Map())).toBe("pessoal");
  });
});
