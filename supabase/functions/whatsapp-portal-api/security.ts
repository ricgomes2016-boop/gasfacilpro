// Segurança do portal WhatsApp: HMAC-SHA256, janela de tempo, replay e validações.
// Módulo puro (Web Crypto) — sem dependências Deno, para permitir testes unitários.

export const JANELA_MS = 5 * 60 * 1000; // 5 minutos
export const MAX_BODY_BYTES = 32 * 1024; // 32 KB

export const ORIGENS_PERMITIDAS = [
  "https://atendimento.gasfacilpro.com.br",
  "https://fortegas-connect.lovable.app",
];

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = origin && ORIGENS_PERMITIDAS.includes(origin) ? origin : ORIGENS_PERMITIDAS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "content-type, x-gf-timestamp, x-gf-nonce, x-gf-signature, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function stringCanonica(timestamp: string, nonce: string, corpo: string): string {
  return `${timestamp}.${nonce}.${corpo}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function assinar(
  segredo: string,
  timestamp: string,
  nonce: string,
  corpo: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(stringCanonica(timestamp, nonce, corpo)));
  return toHex(sig);
}

/** Comparação de tempo constante entre duas strings hexadecimais. */
export function igualdadeSegura(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type MotivoRejeicao =
  | "assinatura_ausente"
  | "timestamp_invalido"
  | "timestamp_expirado"
  | "nonce_invalido"
  | "payload_excedido"
  | "assinatura_invalida";

export type ResultadoVerificacao = { ok: true } | { ok: false; motivo: MotivoRejeicao };

export async function verificarAssinatura(
  params: {
    segredo: string;
    timestamp: string | null | undefined;
    nonce: string | null | undefined;
    assinatura: string | null | undefined;
    corpo: string;
  },
  agora: number = Date.now(),
  janelaMs: number = JANELA_MS,
): Promise<ResultadoVerificacao> {
  const { segredo, timestamp, nonce, assinatura, corpo } = params;
  if (!timestamp || !nonce || !assinatura) return { ok: false, motivo: "assinatura_ausente" };
  if (nonce.length < 8 || nonce.length > 128) return { ok: false, motivo: "nonce_invalido" };
  if (new TextEncoder().encode(corpo).length > MAX_BODY_BYTES) {
    return { ok: false, motivo: "payload_excedido" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, motivo: "timestamp_invalido" };
  if (Math.abs(agora - ts) > janelaMs) return { ok: false, motivo: "timestamp_expirado" };

  const esperada = await assinar(segredo, String(timestamp), nonce, corpo);
  if (!igualdadeSegura(esperada, assinatura.toLowerCase())) {
    return { ok: false, motivo: "assinatura_invalida" };
  }
  return { ok: true };
}

/** Normaliza telefone para dígitos. */
export function normalizarTelefone(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

/** Mascara telefone em logs: mantém apenas os 4 últimos dígitos. */
export function mascararTelefone(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "****";
  return `****${d.slice(-4)}`;
}

/** Bloqueia create-order sem confirmação explícita do cliente. */
export function podeCriarPedido(body: Record<string, unknown>): boolean {
  return body?.confirmed === true;
}

export const ACTIONS = [
  "health",
  "identify-customer",
  "products",
  "quote",
  "create-order",
  "order-status",
  "cancel-order",
  "drivers",
] as const;
export type Action = (typeof ACTIONS)[number];

export const MUTACOES: Action[] = ["create-order", "cancel-order"];

export function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
