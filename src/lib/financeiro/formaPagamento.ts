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
  // Customizadas mantêm a categoria "outros"; grupo é decidido pelo prefixo.
  if (f.startsWith("custom_avista_") || f.startsWith("custom_aprazo_")) return "outros";
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
  const f = norm(forma);
  // Formas customizadas: grupo vem do prefixo do slug.
  if (f.startsWith("custom_avista_")) return "a_vista";
  if (f.startsWith("custom_aprazo_")) return "a_prazo";
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

// Dicionário de rótulos "built-in" aceitando slugs e variações antigas em PT.
const BUILTIN_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_maquininha: "PIX Maquininha",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  cartao: "Cartão",
  cheque: "Cheque",
  boleto: "Boleto",
  fiado: "Fiado",
  vale_gas: "Vale Gás",
  gas_do_povo: "Gás do Povo",
  transferencia: "Transferência",
};

export interface FormaCustomLite {
  slug: string;
  nome: string;
  icone?: string | null;
  ativo?: boolean;
}

/**
 * Rótulo amigável de uma forma de pagamento para exibição em UI/PDF.
 * - Usa o `nome` da forma customizada quando `customs` está disponível.
 * - Faz fallback prettificando o slug (`custom_avista_vale_gas` -> "Vale Gas").
 * - Nunca retorna o slug técnico cru.
 */
export function formatFormaPagamentoLabel(
  raw: string | null | undefined,
  customs?: FormaCustomLite[] | null,
  opts?: { withIcon?: boolean }
): string {
  if (!raw) return "—";
  // Remove marker técnico [op:UUID|cta:UUID] (ou variações parciais) anexado pelo
  // fluxo de Acerto do Entregador — nunca deve vazar para UI/PDF/exportações.
  const s = String(raw).replace(/\s*\[(?:op|cta)[^\]]*\]/gi, "").trim();
  if (!s) return "—";
  const lower = norm(s);

  if (lower.startsWith("multiplo:")) {
    const partes = s
      .slice("multiplo:".length)
      .split(/[,+]/)
      .map((parte) => parte.trim())
      .filter(Boolean);

    if (partes.length) {
      return partes.map((parte) => formatFormaPagamentoLabel(parte, customs, opts)).join(" + ");
    }
  }

  if (BUILTIN_LABELS[lower]) return BUILTIN_LABELS[lower];

  if (!/^custom_(avista|aprazo)_/.test(lower) && /[A-ZÁÉÍÓÚÃÂÊÔÇ ]/.test(s)) {
    return s;
  }

  if (customs && customs.length) {
    const hit = customs.find((c) => c.slug === s || c.slug === lower);
    if (hit) {
      const icon = opts?.withIcon && hit.icone ? `${hit.icone} ` : "";
      return `${icon}${hit.nome}`;
    }
  }

  const m = lower.match(/^custom_(?:avista|aprazo)_(.+)$/);
  if (m) {
    return m[1]
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return s;
}
