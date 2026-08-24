/**
 * Sanitização obrigatória: nada de PEM, PFX, senha, base64 longo, XML,
 * CNPJ/chave ou token pode chegar aos logs ou às respostas de erro.
 */

const PADROES: Array<[RegExp, string]> = [
  [/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[pem]"],
  [/[A-Za-z0-9+/=]{60,}/g, "[base64]"],
  [/<[^>]{1,80}>[\s\S]{0,200}?<\/[^>]{1,80}>/g, "[xml]"],
  [/\b\d{11,}\b/g, "[num]"],
  [/(senha|password|passphrase|secret|token|authorization|apikey)["'\s:=]+[^\s",}]+/gi, "$1=[oculto]"],
];

export function sanitizar(valor: unknown, limite = 300): string {
  let texto = typeof valor === "string" ? valor : String((valor as Error)?.message ?? valor ?? "");
  for (const [re, sub] of PADROES) texto = texto.replace(re, sub);
  return texto.slice(0, limite);
}

export function classificarErro(e: unknown): { categoria: string; detalhe: string } {
  const err = e as NodeJS.ErrnoException & { name?: string };
  const nome = err?.name || "Error";
  const codigo = String(err?.code || "");
  const detalhe = sanitizar(`${nome}${codigo ? `(${codigo})` : ""}: ${err?.message ?? e}`);
  const m = detalhe.toLowerCase();
  let categoria = "rede_desconhecida";
  if (codigo === "ETIMEDOUT" || nome === "AbortError" || /timeout|timed out/.test(m)) categoria = "timeout_sefaz";
  else if (codigo === "ENOTFOUND" || codigo === "EAI_AGAIN" || /dns/.test(m)) categoria = "dns_falhou";
  else if (/mac could not be verified|invalid password|wrong password/.test(m)) categoria = "senha_invalida";
  else if (/unknown ca|bad certificate|certificate required|handshake failure|alert/.test(m)) categoria = "tls_certificado_rejeitado";
  else if (/tls|ssl|handshake/.test(m)) categoria = "tls_handshake_falhou";
  else if (codigo === "ECONNRESET" || /reset|econnrefused|socket hang up/.test(m)) categoria = "conexao_interrompida";
  else if (/^http \d{3}/.test(m)) categoria = "http_erro";
  return { categoria, detalhe };
}

/** Logger que sanitiza tudo antes de escrever. */
export const log = {
  info: (evento: string, dados: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ nivel: "info", evento, ...mapear(dados) })),
  warn: (evento: string, dados: Record<string, unknown> = {}) =>
    console.warn(JSON.stringify({ nivel: "warn", evento, ...mapear(dados) })),
  error: (evento: string, dados: Record<string, unknown> = {}) =>
    console.error(JSON.stringify({ nivel: "error", evento, ...mapear(dados) })),
};

function mapear(dados: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    saida[k] = typeof v === "number" || typeof v === "boolean" ? v : sanitizar(v, 200);
  }
  return saida;
}

/** Máscara para identificadores que podem aparecer em log de auditoria. */
export function mascarar(valor: string | null | undefined, visiveis = 4): string {
  const v = String(valor ?? "");
  if (v.length <= visiveis) return "*".repeat(v.length);
  return `${"*".repeat(Math.min(8, v.length - visiveis))}${v.slice(-visiveis)}`;
}
