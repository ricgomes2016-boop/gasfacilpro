export type DespesaResultadoInput = {
  categoria?: string | null;
  descricao?: string | null;
  referenciaTipo?: string | null;
  compraId?: string | number | null;
  status?: string | null;
};

export const normalizeFinanceText = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const isDespesaRejeitadaResultado = (input: DespesaResultadoInput) =>
  normalizeFinanceText(input.status) === "rejeitada";

export const isTransferenciaInternaResultado = (input: DespesaResultadoInput) => {
  const text = `${normalizeFinanceText(input.categoria)} ${normalizeFinanceText(input.descricao)}`;
  return (
    text.includes("deposito banc") ||
    text.includes("transferencia caixa") ||
    text.includes("transferencia entre contas") ||
    text.includes("suprimento de caixa")
  );
};

export const isCompraMercadoriaResultado = (input: DespesaResultadoInput) => {
  if (input.compraId) return true;
  const text = `${normalizeFinanceText(input.categoria)} ${normalizeFinanceText(input.descricao)}`;
  return (
    text.includes("compra") ||
    text.includes("mercadoria") ||
    text.includes("estoque") ||
    text.includes("glp") ||
    text.includes("botij") ||
    text.includes("vasilhame")
  );
};

export const isLiquidacaoTituloResultado = (input: DespesaResultadoInput) => {
  const text = `${normalizeFinanceText(input.categoria)} ${normalizeFinanceText(input.descricao)}`;
  const ref = normalizeFinanceText(input.referenciaTipo);
  return (
    ref.includes("conta_pagar") ||
    ref.includes("contas_pagar") ||
    ref.includes("conta pagar") ||
    ref.includes("contas pagar") ||
    ref.includes("compra") ||
    text.includes("contas_pagar") ||
    text.includes("contas pagar") ||
    text.includes("contas a pagar") ||
    text.startsWith("pagto") ||
    text.includes("pagto ") ||
    text.includes("pagamento de compra")
  );
};

export const isDespesaOperacionalResultado = (input: DespesaResultadoInput) =>
  !isDespesaRejeitadaResultado(input) &&
  !isTransferenciaInternaResultado(input) &&
  !isCompraMercadoriaResultado(input) &&
  !isLiquidacaoTituloResultado(input);
