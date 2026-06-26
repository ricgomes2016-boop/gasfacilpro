// Detecta o provedor de integração API a partir do nome do banco.
// Retorna null quando a conta não tem integração disponível (apenas movimentação manual).

export type BankProvider = "asaas" | "pagbank" | "itau" | null;

export interface BankProviderInfo {
  id: Exclude<BankProvider, null>;
  label: string;
  description: string;
  capabilities: Array<"saldo" | "extrato" | "pix" | "boleto" | "maquininha">;
  docsUrl: string;
}

export const PROVIDER_INFO: Record<Exclude<BankProvider, null>, BankProviderInfo> = {
  asaas: {
    id: "asaas",
    label: "Asaas",
    description: "Conta digital + emissão de boletos e Pix via API.",
    capabilities: ["saldo", "extrato", "pix", "boleto"],
    docsUrl: "https://docs.asaas.com/",
  },
  pagbank: {
    id: "pagbank",
    label: "PagBank / PagSeguro",
    description: "Conta digital, Pix, boleto e recebíveis de maquininha.",
    capabilities: ["saldo", "extrato", "pix", "boleto", "maquininha"],
    docsUrl: "https://dev.pagbank.uol.com.br/reference",
  },
  itau: {
    id: "itau",
    label: "Itaú",
    description: "Integração via Itaú Open Banking (em breve).",
    capabilities: ["saldo", "extrato", "pix"],
    docsUrl: "https://devportal.itau.com.br/",
  },
};

export function getBankProvider(banco: string | null | undefined): BankProvider {
  if (!banco) return null;
  const n = banco.toLowerCase().trim();
  if (n.includes("asaas")) return "asaas";
  if (n.includes("pagbank") || n.includes("pagseguro") || n.includes("pag bank")) return "pagbank";
  // Itaú fica desativado por enquanto — habilitar quando edge function existir
  // if (n === "itau" || n === "itaú" || n.startsWith("itau")) return "itau";
  return null;
}

export function getProviderInfo(provider: BankProvider): BankProviderInfo | null {
  if (!provider) return null;
  return PROVIDER_INFO[provider];
}
