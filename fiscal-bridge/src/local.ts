/** Helpers puros do modo local (testáveis sem subir o servidor HTTP). */

export interface CabecalhosCors {
  [k: string]: string;
}

/**
 * CORS explícito por origem. Sem origem permitida não há cabeçalho — e as rotas
 * que exigem leitura pelo navegador (inclusive /health) devolvem 403.
 */
export function cabecalhosCorsLocal(origem: string | undefined, permitidas: string[]): CabecalhosCors {
  const alvo = (origem ?? "").replace(/\/+$/, "");
  if (!alvo || !permitidas.map((o) => o.replace(/\/+$/, "")).includes(alvo)) return {};
  return {
    "Access-Control-Allow-Origin": alvo,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-agente-token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** CNPJ nunca é exposto por inteiro: apenas raiz mascarada + 4 últimos dígitos. */
export function mascararCnpj(cnpj: string | null | undefined): string | null {
  const v = String(cnpj ?? "").replace(/\D/g, "");
  if (v.length !== 14) return null;
  return `**.***.***/****-${v.slice(12)}`;
}

/** Comparação em tempo constante para o token de pareamento. */
export function tokensIguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
