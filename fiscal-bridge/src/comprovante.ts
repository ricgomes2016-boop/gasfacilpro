import crypto from "node:crypto";

/**
 * Comprovante HMAC LOCAL da resposta de manifestação.
 *
 * Limite honesto e deliberado: a chave é derivada do token de pareamento, que o
 * navegador também conhece. Portanto o comprovante serve para conferência LOCAL
 * (comando de diagnóstico / suporte) e NÃO é prova criptográfica para a nuvem.
 *
 * A prova aceita pela nuvem é outra: o XML do evento assinado em XMLDSig com o
 * certificado A1 (chave privada que só existe no PC), validado pela Edge Function
 * `dfe-evento-ingerir` contra o certificado da unidade. Ver README.
 */
export interface DadosComprovante {
  chave: string;
  tipo: string;
  cStat: string;
  protocolo: string;
  dhResposta: string;
}

function chaveHmac(token: string): Buffer {
  return crypto.createHash("sha256").update(`comprovante-local|${token}`, "utf8").digest();
}

export function textoCanonico(d: DadosComprovante): string {
  return [d.chave, d.tipo, d.cStat, d.protocolo, d.dhResposta].map((v) => String(v ?? "")).join("|");
}

export function gerarComprovante(d: DadosComprovante, token: string): string {
  return crypto.createHmac("sha256", chaveHmac(token)).update(textoCanonico(d), "utf8").digest("hex");
}

export function conferirComprovante(d: DadosComprovante, token: string, hmac: string): boolean {
  const esperado = gerarComprovante(d, token);
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(String(hmac ?? ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
