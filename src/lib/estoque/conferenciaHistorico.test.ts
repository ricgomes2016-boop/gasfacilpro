import { describe, expect, it } from "vitest";
import { agruparHistorico } from "./conferenciaHistorico";

describe("agruparHistorico", () => {
  it("agrupa por data da contagem e soma totais por produto", () => {
    const r = agruparHistorico([
      { data_contagem: "2026-10-23", data_conferencia: "2026-10-22", momento: "inicio", unidade_id: "a", produto_grupo: "P13", tipo_estoque: "cheio", quantidade: 546 },
      { data_contagem: "2026-10-23", data_conferencia: "2026-10-22", momento: "inicio", unidade_id: "b", produto_grupo: "P13", tipo_estoque: "cheio", quantidade: 1099 },
      { data_contagem: "2026-10-23", data_conferencia: "2026-10-22", momento: "inicio", unidade_id: "a", produto_grupo: "P13", tipo_estoque: "vazio", quantidade: 55 },
    ], [{ data_conferencia: "2026-10-22", unidade_id: "a", produto_grupo: "P13", tipo_estoque: "cheio", quantidade: 559 }]);
    expect(r).toHaveLength(2);
    expect(r[0].dataContagem).toBe("2026-10-23");
    expect(r[0].lojas).toEqual(["a", "b"]);
    expect(r[0].totais.P13).toEqual({ cheio: 1645, vazio: 55 });
    expect(r[1].totais.P13.cheio).toBe(559);
  });
});
