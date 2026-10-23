export interface FluxoConferenciaInput {
  saldoInicial: number;
  entrada: number;
  transferencia: number;
  cheio: number;
}

export type MomentoContagem = 'inicio' | 'fim';

/** Opening counts close yesterday; closing counts close the physical counting day. */
export function datasApuracao(dataContagem: string, momento: MomentoContagem) {
  const day = new Date(`${dataContagem}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataContagem) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== dataContagem) throw new Error('Data inválida');
  if (momento === 'inicio') day.setUTCDate(day.getUTCDate() - 1);
  const dataVenda = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() - 1);
  return { dataVenda, dataSaldo: day.toISOString().slice(0, 10) };
}

/** New sales-day records override legacy opening counts, preserving untouched history. */
export function combinarContagens<T extends { unidade_id: string; produto_grupo: string; tipo_estoque: string }>(legacy: T[], current: T[]): T[] {
  const rows = new Map<string, T>();
  for (const row of [...legacy, ...current]) rows.set(`${row.unidade_id}:${row.produto_grupo}:${row.tipo_estoque}`, row);
  return [...rows.values()];
}

export interface FluxoConferencia extends FluxoConferenciaInput {
  totalInicial: number;
  vendaEsperada: number;
}

/** Venda esperada = saldo inicial + entrada - transferência - contagem de cheios. */
export function calcularFluxoConferencia(input: FluxoConferenciaInput): FluxoConferencia {
  const n = (v: number) => (Number.isFinite(v) ? Number(v) : 0);
  const saldoInicial = n(input.saldoInicial);
  const entrada = n(input.entrada);
  const transferencia = n(input.transferencia);
  const cheio = n(input.cheio);
  const totalInicial = saldoInicial + entrada;
  return { saldoInicial, entrada, transferencia, cheio, totalInicial, vendaEsperada: totalInicial - transferencia - cheio };
}

export interface SaldoCheioVazio {
  cheio: number;
  vazio: number;
}

/** A received full container replaces one empty container. */
export function saldoComEntradas(saldo: SaldoCheioVazio, entrada: number): SaldoCheioVazio {
  return { cheio: saldo.cheio + entrada, vazio: saldo.vazio - entrada };
}

/** Saldo inicial = ajuste manual do Master quando existir; senão, a contagem do dia anterior. */
export function resolverSaldoInicial(ajuste: SaldoCheioVazio | null | undefined, anterior: SaldoCheioVazio | null | undefined): SaldoCheioVazio {
  if (ajuste) return { cheio: Number(ajuste.cheio) || 0, vazio: Number(ajuste.vazio) || 0 };
  return { cheio: Number(anterior?.cheio) || 0, vazio: Number(anterior?.vazio) || 0 };
}

export interface FluxoDia {
  inicial: number;
  entradas: number;
  total: number;
  transferencias: number;
  disponivel: number;
  fechamento: number;
  venda: number;
}

/** Fluxo de um dia de venda: inicial + entradas − transferências − contagem de fechamento. */
export function calcularFluxoDia(input: { inicial: number; entradas: number; transferencias: number; fechamento: number }): FluxoDia {
  const n = (v: number) => (Number.isFinite(v) ? Number(v) : 0);
  const inicial = n(input.inicial), entradas = n(input.entradas), transferencias = n(input.transferencias), fechamento = n(input.fechamento);
  const total = inicial + entradas;
  const disponivel = total - transferencias;
  return { inicial, entradas, total, transferencias, disponivel, fechamento, venda: disponivel - fechamento };
}

/** Estoque atual do dia em andamento: contagem de abertura + entradas − transferências do próprio dia. */
export function calcularEstoqueAtual(input: { abertura: number; entradas: number; transferencias: number }) {
  return (Number(input.abertura) || 0) + (Number(input.entradas) || 0) - (Number(input.transferencias) || 0);
}

/**
 * Efeito em cheio/vazio dos movimentos de uma loja: entrada troca vazio por cheio;
 * transferência enviada sai cheio e volta vazio; recebida entra cheio e sai vazio.
 */
export function efeitoMovimentos(input: { entrada: number; enviada: number; recebida: number }): SaldoCheioVazio {
  const e = Number(input.entrada) || 0, s = Number(input.enviada) || 0, r = Number(input.recebida) || 0;
  return { cheio: e - s + r, vazio: -e + s - r };
}

/** Colunas da tabela de contagem: Cheio, Vazio e Total, na ordem.
    Vale para Master e conferentes — entradas e transferências têm tabelas próprias. */
export const COLUNAS_CONTAGEM = ["che", "vaz", "tot"] as const;

export function colunasDeContagem<T extends { key: string }>(colunas: T[], _isMaster = false): T[] {
  return COLUNAS_CONTAGEM.map((key) => colunas.find((c) => c.key === key)).filter(Boolean) as T[];
}
