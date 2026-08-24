// Cliente assinado (HMAC SHA-256) para o serviço externo `fiscal-bridge`,
// que executa o mTLS contra a SEFAZ (não suportado pelo runtime das functions).
// Nunca envia certificado/senha: o bridge busca o A1 no cofre por conta própria.

export const BRIDGE_URL = (Deno.env.get("FISCAL_BRIDGE_URL") || "").replace(/\/+$/, "");
const BRIDGE_SECRET = Deno.env.get("FISCAL_BRIDGE_SECRET") || "";

export function bridgeConfigurado(): boolean {
  return Boolean(BRIDGE_URL && BRIDGE_SECRET);
}

export const MENSAGEM_BRIDGE_AUSENTE =
  "A consulta à SEFAZ exige o serviço fiscal-bridge (mTLS), que ainda não está configurado. " +
  "Implante o bridge e cadastre FISCAL_BRIDGE_URL e FISCAL_BRIDGE_SECRET nos segredos do projeto.";

async function assinar(timestamp: string, nonce: string, caminho: string, corpo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(BRIDGE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(`${timestamp}.${nonce}.${caminho}.${corpo}`),
  );
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface RespostaBridge<T = Record<string, unknown>> {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  detalheTecnico?: string;
  dados?: T;
}

/** Chama o bridge assinando exatamente o corpo enviado. */
export async function chamarBridge<T = Record<string, unknown>>(
  caminho: string,
  payload: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<RespostaBridge<T>> {
  if (!bridgeConfigurado()) {
    return { ok: false, motivo: "bridge_nao_configurado", mensagem: MENSAGEM_BRIDGE_AUSENTE };
  }
  const corpo = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const assinatura = await assinar(timestamp, nonce, caminho, corpo);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BRIDGE_URL}${caminho}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-timestamp": timestamp,
        "x-bridge-nonce": nonce,
        "x-bridge-signature": assinatura,
      },
      body: corpo,
      signal: ac.signal,
    });
    const texto = await resp.text();
    let dados: Record<string, unknown>;
    try {
      dados = JSON.parse(texto || "{}");
    } catch {
      console.error(`[fiscal-bridge] resposta não-JSON status=${resp.status}`);
      return { ok: false, motivo: "bridge_resposta_invalida", mensagem: "O serviço fiscal respondeu em formato inesperado." };
    }
    if (resp.status === 401) {
      console.error(`[fiscal-bridge] autenticação recusada motivo=${String(dados.motivo ?? "")}`);
      return { ok: false, motivo: "bridge_nao_autorizado", mensagem: "O serviço fiscal recusou a autenticação. Verifique o segredo compartilhado." };
    }
    return { ok: dados.ok === true, motivo: dados.motivo as string | undefined, mensagem: dados.mensagem as string | undefined, dados: dados as T };
  } catch (e) {
    const nome = (e as Error)?.name;
    console.error(`[fiscal-bridge] falha de comunicação erro=${nome}`);
    return {
      ok: false,
      motivo: nome === "AbortError" ? "bridge_timeout" : "bridge_indisponivel",
      mensagem: "Não foi possível falar com o serviço fiscal (bridge). Verifique se ele está online.",
    };
  } finally {
    clearTimeout(timer);
  }
}
