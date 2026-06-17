/**
 * Helpers para classificar e categorizar formas de pagamento em Contas a Receber.
 */

export type FormaCategoria =
  | "dinheiro"
  | "pix"
  | "pix_maquininha"
  | "cartao_debito"
  | "cartao_credito"
  | "boleto"
  | "transferencia"
  | "cheque"
  | "fiado"
  | "vale_gas"
  | "gas_do_povo"
  | "outros";

export type FormaGrupo = "a_vista" | "a_prazo" | "outros";

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function getFormaCategoria(forma: string | null | undefined): FormaCategoria {
  const f = norm(forma);
  if (!f) return "outros";
  if (f.includes("povo")) return "gas_do_povo";
  if (f.includes("pix_maquininha") || f.includes("pix maquininha")) return "pix_maquininha";
  if (f === "pix" || f.startsWith("pix")) return "pix";
  if (f.includes("debito")) return "cartao_debito";
  if (f.includes("credito") || f === "cartao") return "cartao_credito";
  if (f.includes("boleto")) return "boleto";
  if (f.includes("transfer")) return "transferencia";
  if (f.includes("cheque")) return "cheque";
  if (f.includes("fiado")) return "fiado";
  if (f.includes("vale")) return "vale_gas";
  if (f.includes("dinheiro") || f.includes("especie")) return "dinheiro";
  return "outros";
}

export function getFormaGrupo(forma: string | null | undefined): FormaGrupo {
  const cat = getFormaCategoria(forma);
  // À vista (liquidação imediata para o cliente):
  // - Dinheiro e PIX puro: liquidam instantaneamente (auto-baixa segura).
  // - Cartão e PIX maquininha: representam recebível do adquirente (D+1/D+30),
  //   tratados na Conciliação Cartão; permanecem "pendentes" aqui.
  if (cat === "dinheiro" || cat === "pix") return "a_vista";
  if (
    cat === "boleto" ||
    cat === "fiado" ||
    cat === "cheque" ||
    cat === "vale_gas" ||
    cat === "gas_do_povo" ||
    cat === "transferencia" ||
    cat === "cartao_debito" ||
    cat === "cartao_credito" ||
    cat === "pix_maquininha"
  ) {
    return "a_prazo";
  }
  return "outros";
}

/**
 * Indica se a forma de pagamento liquida instantaneamente do ponto de vista
 * do cliente — quando true, a conta a receber deve nascer já como `recebida`.
 */
export function isFormaAVista(forma: string | null | undefined): boolean {
  return getFormaGrupo(forma) === "a_vista";
}

export const FORMA_LABELS: Record<FormaCategoria, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_maquininha: "PIX Maquininha",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
  cheque: "Cheque",
  fiado: "Fiado",
  vale_gas: "Vale Gás",
  gas_do_povo: "Gás do Povo",
  outros: "Outros",
};
