import { normalizeFinText } from "./padroesFinanceiros";

export function isOperadoraPagBank(nome: string | null | undefined): boolean {
  const normalized = normalizeFinText(nome);
  return normalized.includes("pagbank") || normalized.includes("pagseguro") || normalized.includes("pag seguro");
}

export function prazoOperadoraD0(params: {
  nome?: string | null;
  prazoCadastro?: number | string | null;
  prazoPadrao: number;
}): number {
  if (isOperadoraPagBank(params.nome)) return 0;

  if (params.prazoCadastro !== null && params.prazoCadastro !== undefined && params.prazoCadastro !== "") {
    const prazo = Number(params.prazoCadastro);
    if (Number.isFinite(prazo) && prazo >= 0) return prazo;
  }

  return params.prazoPadrao;
}
