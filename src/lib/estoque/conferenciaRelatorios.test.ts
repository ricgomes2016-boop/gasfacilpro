import { describe, it, expect } from "vitest";
import { relatorioEntradas, relatorioRecebidas, relatorioVendas } from "./conferenciaRelatorios";

const U = "usagas", S = "sertaneja", V = "vj";
describe("relatórios de conferência", () => {
  it("venda de 22/10 = 812 + 456 − 62 − 1099 = 107", () => {
    const c = [
      { data_contagem: "2026-10-22", data_conferencia: "2026-10-21", momento: "inicio", unidade_id: U, produto_grupo: "P13", tipo_estoque: "cheio", quantidade: 812 },
      { data_contagem: "2026-10-23", data_conferencia: "2026-10-22", momento: "inicio", unidade_id: U, produto_grupo: "P13", tipo_estoque: "cheio", quantidade: 1099 },
    ];
    const m = [
      { tipo: "entrada_manual", unidade_id: U, produto_grupo: "P13", quantidade: 456, data_conferencia: "2026-10-22" },
      { tipo: "transferencia", unidade_id: U, unidade_destino_id: V, produto_grupo: "P13", quantidade: 62, data_conferencia: "2026-10-22" },
      { tipo: "entrada_manual", unidade_id: U, produto_grupo: "P13", quantidade: 187, data_conferencia: "2026-10-23" },
    ];
    const v = relatorioVendas(c, [], m, [], [U], "2026-10-22", "2026-10-22");
    expect(v.find((l) => l.grupo === "P13")?.quantidade).toBe(107);
  });
  it("entrada de 187 em 23/10 aparece em 23/10", () => {
    const e = relatorioEntradas([{ tipo: "entrada_manual", unidade_id: U, produto_grupo: "P13", quantidade: 187, data_conferencia: "2026-10-23" }], [U], "2026-10-01", "2026-10-31");
    expect(e).toEqual([{ data: "2026-10-23", unidadeId: U, grupo: "P13", quantidade: 187 }]);
  });
  it("36 P13 Usagas→Sertaneja é recebida pela Sertaneja", () => {
    const m = [{ tipo: "transferencia", unidade_id: U, unidade_destino_id: S, produto_grupo: "P13", quantidade: 36, data_conferencia: "2026-10-23" }];
    expect(relatorioRecebidas(m, [S], "2026-10-23", "2026-10-23")[0]).toMatchObject({ unidadeId: S, origemId: U, quantidade: 36 });
    expect(relatorioRecebidas(m, [U], "2026-10-23", "2026-10-23")).toHaveLength(0);
  });
  it("dia sem fechamento fica sem número", () => {
    const c = [{ data_contagem: "2026-10-22", data_conferencia: "2026-10-21", momento: "inicio", unidade_id: U, produto_grupo: "P13", tipo_estoque: "cheio", quantidade: 812 }];
    expect(relatorioVendas(c, [], [], [], [U], "2026-10-22", "2026-10-22")[0].quantidade).toBeNull();
  });
});
