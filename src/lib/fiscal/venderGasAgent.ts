import { getAgenteConfig } from "./agenteLocal";

export interface VenderGasItem {
  produtoId?: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

export interface VenderGasPayload {
  tipoDocumento: "nfe" | "nfce";
  unidadeId: string;
  cnpjEmitente: string;
  pedidoId: string;
  numeroPedido: string;
  somentePreparar?: boolean;
  destinatario: {
    nome: string;
    cpfCnpj?: string;
    inscricaoEstadual?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    cidade?: string;
    uf?: string;
    codigoMunicipio?: string;
    telefone?: string;
  };
  itens: VenderGasItem[];
  valorTotal: number;
  formaPagamento?: string;
  observacoes?: string;
}

export interface VenderGasResposta {
  ok: boolean;
  motivo?: string;
  mensagem: string;
  etapa?: string;
  numero?: string;
  chaveAcesso?: string;
  protocolo?: string;
  url?: string;
}

async function chamar(caminho: string, corpo: unknown, timeout = 120_000): Promise<VenderGasResposta> {
  const cfg = getAgenteConfig();
  if (!cfg.token.trim()) return { ok: false, motivo: "token_vazio", mensagem: "Configure o token do Agente Fiscal Local." };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${cfg.url}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agente-Token": cfg.token },
      body: JSON.stringify(corpo),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return {
      ...data,
      ok: response.ok && data?.ok === true,
      mensagem: String(data?.mensagem || (response.ok ? "Operação concluída." : "O agente recusou a operação.")),
    } as VenderGasResposta;
  } catch (error: any) {
    return {
      ok: false,
      motivo: error?.name === "AbortError" ? "tempo_esgotado" : "agente_offline",
      mensagem: error?.name === "AbortError"
        ? "O Vender Gás demorou demais para responder. Confira a janela aberta pelo agente."
        : "Não foi possível falar com o Agente Fiscal Local neste computador.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export function abrirLoginVenderGas(unidadeId: string, cnpjEmitente: string) {
  return chamar("/vendergas/abrir-login", { unidadeId, cnpj: cnpjEmitente }, 30_000);
}

export function emitirDocumentoVenderGas(payload: VenderGasPayload) {
  return chamar("/vendergas/emitir", payload, 180_000);
}
