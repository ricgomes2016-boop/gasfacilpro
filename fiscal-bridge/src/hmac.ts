import { createHmac, timingSafeEqual } from "node:crypto";

/** Janela máxima aceita entre o timestamp assinado e o relógio do bridge. */
export const JANELA_MS = 120_000;

export interface AssinaturaEntrada {
  segredo: string;
  timestamp: string;
  nonce: string;
  caminho: string;
  corpo: string;
}

/** String canônica assinada: timestamp.nonce.caminho.corpo */
export function stringCanonica({ timestamp, nonce, caminho, corpo }: Omit<AssinaturaEntrada, "segredo">): string {
  return `${timestamp}.${nonce}.${caminho}.${corpo}`;
}

export function assinar(entrada: AssinaturaEntrada): string {
  return createHmac("sha256", entrada.segredo).update(stringCanonica(entrada), "utf8").digest("hex");
}

function igualdadeSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Cache de nonces já usados, com expiração automática (anti-replay). */
export class RegistroNonce {
  private usados = new Map<string, number>();
  constructor(private janelaMs = JANELA_MS) {}

  registrar(nonce: string, agora = Date.now()): boolean {
    this.limpar(agora);
    if (this.usados.has(nonce)) return false;
    this.usados.set(nonce, agora);
    return true;
  }

  private limpar(agora: number) {
    for (const [nonce, quando] of this.usados) {
      if (agora - quando > this.janelaMs * 2) this.usados.delete(nonce);
    }
  }

  get tamanho() {
    return this.usados.size;
  }
}

export type ResultadoVerificacao =
  | { ok: true }
  | { ok: false; motivo: "assinatura_ausente" | "timestamp_invalido" | "timestamp_expirado" | "replay" | "assinatura_invalida" };

export function verificarAssinatura(
  params: {
    segredo: string;
    timestamp: string | undefined | null;
    nonce: string | undefined | null;
    assinatura: string | undefined | null;
    caminho: string;
    corpo: string;
  },
  registro: RegistroNonce,
  agora = Date.now(),
  janelaMs = JANELA_MS,
): ResultadoVerificacao {
  const { segredo, timestamp, nonce, assinatura, caminho, corpo } = params;
  if (!timestamp || !nonce || !assinatura) return { ok: false, motivo: "assinatura_ausente" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, motivo: "timestamp_invalido" };
  if (Math.abs(agora - ts) > janelaMs) return { ok: false, motivo: "timestamp_expirado" };

  const esperada = assinar({ segredo, timestamp: String(timestamp), nonce, caminho, corpo });
  if (!igualdadeSegura(esperada, assinatura)) return { ok: false, motivo: "assinatura_invalida" };
  if (!registro.registrar(nonce, agora)) return { ok: false, motivo: "replay" };
  return { ok: true };
}
