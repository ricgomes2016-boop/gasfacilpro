/**
 * Utilitários de conversão P13 equivalente para o módulo Transportadora
 */

// 6 P45 = 24 P13 → 1 P45 = 4 P13
// 7 P20 = 24 P13 → 1 P20 ≈ 3.4286 P13
export const P45_TO_P13 = 4;
export const P20_TO_P13 = 24 / 7; // ≈ 3.4286

export function calcP13Equivalente(p13: number, p20: number, p45: number): number {
  return p13 + p20 * P20_TO_P13 + p45 * P45_TO_P13;
}

export function calcCapacidadeP13Equiv(capP13: number, capP20: number, capP45: number): number {
  return calcP13Equivalente(capP13, capP20, capP45);
}

export function calcCustoCombustivel(km: number, consumoKmLitro: number, precoLitro: number, idaVolta: boolean): number {
  const distancia = idaVolta ? km * 2 : km;
  if (consumoKmLitro <= 0) return 0;
  return (distancia / consumoKmLitro) * precoLitro;
}

export function calcSalarioDiario(salarioMensal: number): number {
  return salarioMensal / 30;
}

export function calcCustoTotal(params: {
  combustivel: number;
  pedagio: number;
  refeicao: number;
  motorista: number;
  ajudante: number;
}): number {
  return params.combustivel + params.pedagio + params.refeicao + params.motorista + params.ajudante;
}

export function calcCustoPorP13Equiv(custoTotal: number, p13Equiv: number): number {
  if (p13Equiv <= 0) return 0;
  return custoTotal / p13Equiv;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
