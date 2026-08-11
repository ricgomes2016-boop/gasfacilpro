import { describe, expect, it } from "vitest";
import { isDespesaOperacionalResultado } from "./despesasResultado";

describe("despesasResultado", () => {
  it("inclui pro labore como despesa operacional valida", () => {
    expect(isDespesaOperacionalResultado({ categoria: "Pro-Labore", descricao: "Retirada socio", status: "pendente" })).toBe(true);
    expect(isDespesaOperacionalResultado({ categoria: "Pro Labore", descricao: "Retirada socio", status: "aprovada" })).toBe(true);
  });

  it("exclui despesas rejeitadas, compras e liquidacoes de contas a pagar", () => {
    expect(isDespesaOperacionalResultado({ categoria: "Pro-Labore", status: "rejeitada" })).toBe(false);
    expect(isDespesaOperacionalResultado({ categoria: "Compra de GLP P13", status: "aprovada" })).toBe(false);
    expect(isDespesaOperacionalResultado({ categoria: "Contas a pagar", referenciaTipo: "contas_pagar" })).toBe(false);
  });
});
