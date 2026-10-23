export interface FluxoConferenciaInput {
  saldoInicial: number;
  entrada: number;
  transferencia: number;
  cheio: number;
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

/** Saldo inicial = ajuste manual do Master quando existir; senão, a contagem do dia anterior. */
export function resolverSaldoInicial(ajuste: SaldoCheioVazio | null | undefined, anterior: SaldoCheioVazio | null | undefined): SaldoCheioVazio {
  if (ajuste) return { cheio: Number(ajuste.cheio) || 0, vazio: Number(ajuste.vazio) || 0 };
  return { cheio: Number(anterior?.cheio) || 0, vazio: Number(anterior?.vazio) || 0 };
}
