import { describe, it, expect } from "vitest";
import { calcularFluxoConferencia } from "./conferenciaFluxo";

describe("calcularFluxoConferencia", () => {
  it("exemplo do cliente: 500 + 200 - 100 - 400 = 200", () => {
    const r = calcularFluxoConferencia({ saldoInicial: 500, entrada: 200, transferencia: 100, cheio: 400 });
    expect(r.totalInicial).toBe(700);
    expect(r.vendaEsperada).toBe(200);
  });
  it("total inicial é saldo inicial + entrada", () => {
    expect(calcularFluxoConferencia({ saldoInicial: 250, entrada: 100, transferencia: 0, cheio: 214 }).totalInicial).toBe(350);
  });
  it("sem transferência: 250 + 100 - 214 = 136", () => {
    expect(calcularFluxoConferencia({ saldoInicial: 250, entrada: 100, transferencia: 0, cheio: 214 }).vendaEsperada).toBe(136);
  });
});
