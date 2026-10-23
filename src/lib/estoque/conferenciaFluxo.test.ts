import { describe, it, expect } from "vitest";
import { calcularFluxoConferencia } from "./conferenciaFluxo";
import { datasApuracao, combinarContagens } from './conferenciaFluxo';
import { saldoComEntradas } from './conferenciaFluxo';

describe('saldo após entrada', () => {
  it('100 cheios recebidos acrescentam 100 cheios e retiram 100 vazios', () => {
    expect(saldoComEntradas({ cheio: 200, vazio: 300 }, 100)).toEqual({ cheio: 300, vazio: 200 });
  });
});

describe('datas da contagem', () => {
  it('início de 23/10 apura vendas de 22/10', () => {
    expect(datasApuracao('2026-10-23', 'inicio')).toEqual({ dataVenda: '2026-10-22', dataSaldo: '2026-10-21' });
  });
  it('fim de 22/10 apura o próprio dia', () => {
    expect(datasApuracao('2026-10-22', 'fim')).toEqual({ dataVenda: '2026-10-22', dataSaldo: '2026-10-21' });
  });
  it('Ibaiti: 559 anteriores e 546 cheios apuram 13 vendas; 55 vazios não são vendas', () => {
    const contagem = { cheio: 546, vazio: 55 };
    expect(calcularFluxoConferencia({ saldoInicial: 559, entrada: 0, transferencia: 0, cheio: contagem.cheio }).vendaEsperada).toBe(13);
    expect(contagem.cheio + contagem.vazio).toBe(601);
  });
  it('novo fechamento substitui a leitura antiga sem somar as duas contagens', () => {
    const key = { unidade_id: 'ibaiti', produto_grupo: 'P13', tipo_estoque: 'cheio' };
    expect(combinarContagens([{ ...key, quantidade: 559 }], [{ ...key, quantidade: 546 }])).toEqual([{ ...key, quantidade: 546 }]);
  });
});

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

import { resolverSaldoInicial } from "./conferenciaFluxo";
describe("resolverSaldoInicial", () => {
  it("usa o ajuste do Master no lugar da contagem anterior", () => {
    expect(resolverSaldoInicial({ cheio: 200, vazio: 300 }, { cheio: 500, vazio: 10 })).toEqual({ cheio: 200, vazio: 300 });
  });
  it("sem ajuste, usa a contagem do dia anterior", () => {
    expect(resolverSaldoInicial(null, { cheio: 500, vazio: 10 })).toEqual({ cheio: 500, vazio: 10 });
  });
});

import { calcularFluxoDia, calcularEstoqueAtual } from "./conferenciaFluxo";
describe("fluxo do dia de venda", () => {
  it("22/10: 812 + 456 = 1268; − 62 = 1206; − 1099 = 107 vendidos", () => {
    const f = calcularFluxoDia({ inicial: 812, entradas: 456, transferencias: 62, fechamento: 1099 });
    expect(f.total).toBe(1268);
    expect(f.disponivel).toBe(1206);
    expect(f.venda).toBe(107);
  });
  it("entrada de 23/10 (187) não altera a venda de 22/10 e soma no estoque atual de 23/10", () => {
    expect(calcularFluxoDia({ inicial: 812, entradas: 456, transferencias: 62, fechamento: 1099 }).venda).toBe(107);
    expect(calcularEstoqueAtual({ abertura: 1099, entradas: 187, transferencias: 0 })).toBe(1286);
  });
});

import { efeitoMovimentos as efeitoMov } from "./conferenciaFluxo";
describe("efeitoMovimentos", () => {
  it("Usagas transfere 62 P13 para Ibaiti: origem -62 cheio/+62 vazio, destino o inverso", () => {
    expect(efeitoMov({ entrada: 0, enviada: 62, recebida: 0 })).toEqual({ cheio: -62, vazio: 62 });
    expect(efeitoMov({ entrada: 0, enviada: 0, recebida: 62 })).toEqual({ cheio: 62, vazio: -62 });
  });
  it("entrada de 100 cheios tira 100 vazios", () => {
    expect(efeitoMov({ entrada: 100, enviada: 0, recebida: 0 })).toEqual({ cheio: 100, vazio: -100 });
  });
});
