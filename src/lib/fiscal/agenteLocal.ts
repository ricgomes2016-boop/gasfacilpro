// Cliente do "agente local" (fiscal-bridge em modo local) que roda no PC do
// escritório com o certificado A1. O navegador fala com http://127.0.0.1, o
// agente conversa com a SEFAZ por mTLS e devolve apenas os XMLs — que o ERP
// envia para a edge function `dfe-ingerir` para validação e persistência.

export interface AgenteConfig {
  url: string;
  token: string;
}

export interface AgenteStatus {
  online: boolean;
  modo?: string;
  cnpj?: string | null;
  ambiente?: string | null;
  erro?: string;
}

export interface DocumentoAgente {
  nsu: number;
  schema: string | null;
  xml: string;
}

const STORAGE_KEY = "dfe:agente-local";
export const AGENTE_URL_PADRAO = "http://127.0.0.1:8787";

export function getAgenteConfig(): AgenteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AgenteConfig>;
      return { url: (p.url || AGENTE_URL_PADRAO).replace(/\/+$/, ""), token: p.token || "" };
    }
  } catch { /* storage indisponível */ }
  return { url: AGENTE_URL_PADRAO, token: "" };
}

export function setAgenteConfig(cfg: AgenteConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: (cfg.url || AGENTE_URL_PADRAO).replace(/\/+$/, ""), token: cfg.token || "" }));
  } catch { /* storage indisponível */ }
}

async function comTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Ping curto para saber se o agente está ligado neste PC. */
export async function verificarAgente(cfg = getAgenteConfig()): Promise<AgenteStatus> {
  try {
    const resp = await comTimeout(`${cfg.url}/health`, { method: "GET" }, 2500);
    if (!resp.ok) return { online: false, erro: `HTTP ${resp.status}` };
    const dados = await resp.json();
    return { online: dados?.ok === true, modo: dados?.modo, cnpj: dados?.cnpj ?? null, ambiente: dados?.ambiente ?? null };
  } catch (e: any) {
    return { online: false, erro: e?.name === "AbortError" ? "tempo esgotado" : "agente não respondeu" };
  }
}

async function chamar<T>(caminho: string, corpo: unknown, cfg = getAgenteConfig()): Promise<
  { ok: true; dados: T } | { ok: false; motivo: string; mensagem: string }
> {
  try {
    const resp = await comTimeout(`${cfg.url}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agente-Token": cfg.token },
      body: JSON.stringify(corpo),
    }, 60_000);
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados?.ok === false) {
      return {
        ok: false,
        motivo: String(dados?.motivo || `http_${resp.status}`),
        mensagem: String(dados?.mensagem || "O agente local recusou a requisição."),
      };
    }
    return { ok: true, dados: dados as T };
  } catch (e: any) {
    return {
      ok: false,
      motivo: "agente_offline",
      mensagem: e?.name === "AbortError"
        ? "O agente local demorou demais para responder."
        : "Não foi possível falar com o agente local neste computador.",
    };
  }
}

/** Distribuição DF-e por NSU (um lote de até 50 documentos). */
export function agenteDistribuicao(
  params: { unidadeId: string; cnpj?: string | null; ultNSU: number },
  cfg?: AgenteConfig,
) {
  return chamar<{ cStat: string | null; xMotivo: string | null; ultNSU: number; maxNSU: number; documentos: DocumentoAgente[] }>(
    "/dfe/distribuicao",
    { unidadeId: params.unidadeId, cnpj: params.cnpj ?? undefined, ultNSU: params.ultNSU },
    cfg,
  );
}

/** Download de um DF-e específico pela chave de acesso. */
export function agenteConsultaChave(
  params: { unidadeId: string; cnpj?: string | null; chave: string },
  cfg?: AgenteConfig,
) {
  return chamar<{ chave: string; cStat: string | null; xMotivo: string | null; schema: string | null; completo: boolean; xml: string; titular?: string }>(
    "/dfe/consulta-chave",
    { unidadeId: params.unidadeId, cnpj: params.cnpj ?? undefined, chave: params.chave },
    cfg,
  );
}

export interface RespostaManifestacaoAgente {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
  protocolo: string | null;
  tipo: string;
  sequencia: number;
  dhResposta: string;
  /** XML do evento assinado com o A1 — é a prova que a nuvem consegue verificar. */
  eventoXml: string;
  retornoXml: string;
  comprovanteLocal?: string;
  motivo?: string;
}

/**
 * Manifestação do destinatário executada pelo agente local.
 * O navegador NÃO declara sucesso: o `eventoXml` assinado volta para a Edge
 * `dfe-evento-ingerir`, que confere a assinatura contra o A1 da unidade.
 */
export function agenteManifestar(
  params: { unidadeId: string; cnpj?: string | null; chave: string; tipo: string; justificativa?: string; sequencia?: number },
  cfg?: AgenteConfig,
) {
  return chamar<RespostaManifestacaoAgente>(
    "/dfe/manifestar",
    {
      unidadeId: params.unidadeId,
      cnpj: params.cnpj ?? undefined,
      chave: params.chave,
      tipo: params.tipo,
      justificativa: params.justificativa ?? "",
      sequencia: params.sequencia ?? 1,
    },
    cfg,
  );
}

/** Diagnóstico local autenticado pelo token (certificado, rede, ambiente). */
export function agenteDiagnostico(cfg?: AgenteConfig) {
  return chamar<{
    modo: string; ambiente: string; cnpj: string | null; uf: string | null;
    certificado: { titular: string; validade: string; diasParaVencer: number } | null;
    rede: { sefazAlcancavel: boolean; detalhe?: string };
    versao?: string;
  }>("/diagnostico", {}, cfg);
}

