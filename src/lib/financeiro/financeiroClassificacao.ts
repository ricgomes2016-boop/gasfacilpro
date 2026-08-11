import { getFormaCategoria, getFormaGrupo } from "@/lib/financeiro/formaPagamento";

export interface ContaReceberFinanceira {
  status?: string | null;
  forma_pagamento?: string | null;
  operadora_id?: string | null;
  valor?: number | string | null;
  valor_liquido?: number | string | null;
}

export interface ContaPagarFinanceira {
  status?: string | null;
}

const OPEN_STATUSES = new Set(["pendente", "parcial", "atrasada", "vencida"]);
const PAID_STATUSES = new Set(["recebida", "recebido", "paga", "pago", "conciliada", "conciliado"]);

export function normalizeFinanceText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isStatusRecebido(status: string | null | undefined): boolean {
  return PAID_STATUSES.has(normalizeFinanceText(status));
}

export function isStatusAberto(status: string | null | undefined): boolean {
  const normalized = normalizeFinanceText(status);
  return OPEN_STATUSES.has(normalized) || (!normalized && !isStatusRecebido(status));
}

export function isContaPagarAberta(conta: ContaPagarFinanceira): boolean {
  return isStatusAberto(conta.status) && !["paga", "pago"].includes(normalizeFinanceText(conta.status));
}

export function isRecebivelOperadora(conta: ContaReceberFinanceira): boolean {
  const categoria = getFormaCategoria(conta.forma_pagamento);
  return Boolean(conta.operadora_id) || [
    "cartao_credito",
    "cartao_debito",
    "pix_maquininha",
    "gas_do_povo",
  ].includes(categoria);
}

export function isRecebivelOperadoraAberto(conta: ContaReceberFinanceira): boolean {
  return isRecebivelOperadora(conta) && isStatusAberto(conta.status) && !isStatusRecebido(conta.status);
}

export function isRecebivelCliente(conta: ContaReceberFinanceira): boolean {
  if (isRecebivelOperadora(conta)) return false;

  const forma = normalizeFinanceText(conta.forma_pagamento);
  const categoria = getFormaCategoria(conta.forma_pagamento);
  const grupo = getFormaGrupo(conta.forma_pagamento);

  return (
    categoria === "fiado" ||
    categoria === "boleto" ||
    categoria === "cheque" ||
    categoria === "transferencia" ||
    categoria === "vale_gas" ||
    grupo === "a_prazo" ||
    forma.startsWith("custom_aprazo_")
  );
}

export function isRecebivelClienteAberto(conta: ContaReceberFinanceira): boolean {
  return isRecebivelCliente(conta) && isStatusAberto(conta.status) && !isStatusRecebido(conta.status);
}

export function valorBruto(conta: ContaReceberFinanceira): number {
  return Number(conta.valor || 0);
}

export function valorLiquidoOperadora(conta: ContaReceberFinanceira): number {
  return Number(conta.valor_liquido ?? conta.valor ?? 0);
}

export function sumBy<T>(rows: T[], getter: (row: T) => number): number {
  return rows.reduce((total, row) => total + getter(row), 0);
}
