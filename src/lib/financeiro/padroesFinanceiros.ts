/**
 * Padrões financeiros do sistema — operadora/banco pré-selecionados por forma de pagamento.
 *
 * - PIX (direto)                        → banco Itaú
 * - Crédito / Débito / PIX Maquininha   → operadora PagBank
 * - Gás do Povo                         → operadora Azulzinha
 */

export const OPERADORA_PADRAO_POR_FORMA: Record<string, string> = {
  credito: "pagbank",
  cartao_credito: "pagbank",
  debito: "pagbank",
  cartao_debito: "pagbank",
  pix_maquininha: "pagbank",
  gas_do_povo: "azulzinha",
};

export const BANCO_PADRAO_POR_FORMA: Record<string, string> = {
  pix: "itau",
};

export function normalizeFinText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Nome (parcial) da operadora padrão para a forma informada. */
export function getOperadoraPadrao(forma: string | null | undefined): string | undefined {
  return OPERADORA_PADRAO_POR_FORMA[normalizeFinText(forma)];
}

/** Nome (parcial) do banco padrão para a forma informada. */
export function getBancoPadrao(forma: string | null | undefined): string | undefined {
  return BANCO_PADRAO_POR_FORMA[normalizeFinText(forma)];
}

/** Verifica se um nome de operadora/banco corresponde ao padrão esperado. */
export function matchesNomePadrao(nome: string | null | undefined, padrao: string | undefined): boolean {
  if (!padrao) return false;
  return normalizeFinText(nome).includes(normalizeFinText(padrao));
}
