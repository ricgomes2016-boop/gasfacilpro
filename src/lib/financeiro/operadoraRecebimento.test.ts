import { describe, expect, it } from "vitest";
import { isOperadoraPagBank, prazoOperadoraD0 } from "./operadoraRecebimento";

describe("operadoraRecebimento", () => {
  it("reconhece PagBank e PagSeguro como D+0", () => {
    expect(isOperadoraPagBank("PagBank")).toBe(true);
    expect(isOperadoraPagBank("PagSeguro Internet S.A.")).toBe(true);
    expect(prazoOperadoraD0({ nome: "PagBank", prazoCadastro: 30, prazoPadrao: 30 })).toBe(0);
  });

  it("preserva prazo zero cadastrado em outras operadoras", () => {
    expect(prazoOperadoraD0({ nome: "Outra", prazoCadastro: 0, prazoPadrao: 30 })).toBe(0);
  });

  it("usa prazo padrao somente quando prazo cadastrado esta ausente", () => {
    expect(prazoOperadoraD0({ nome: "Outra", prazoCadastro: null, prazoPadrao: 30 })).toBe(30);
    expect(prazoOperadoraD0({ nome: "Outra", prazoCadastro: "", prazoPadrao: 1 })).toBe(1);
  });
});
