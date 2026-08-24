import { gunzipSync } from "node:zlib";

/** Extrai o conteúdo de uma tag SOAP/XML, ignorando prefixo de namespace. */
export function pick(xml: string, tagName: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tagName}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagName}>`, "i"));
  return m ? m[1].trim() : null;
}

/** Descompacta um docZip (gzip + base64) devolvido pela SEFAZ. */
export function gunzipBase64(b64: string): string {
  const limpo = String(b64 ?? "").replace(/\s/g, "");
  if (!limpo) throw new Error("docZip vazio");
  return gunzipSync(Buffer.from(limpo, "base64")).toString("utf8");
}

export interface DocZip {
  nsu: number;
  schema: string | null;
  xml: string;
}

/** Lista todos os docZip da resposta, já descompactados (ignora os corrompidos). */
export function extrairDocZips(resposta: string): DocZip[] {
  const saida: DocZip[] = [];
  for (const m of resposta.matchAll(/<docZip([^>]*)>([\s\S]*?)<\/docZip>/gi)) {
    const atributos = m[1] ?? "";
    const nsu = Number(atributos.match(/NSU="(\d+)"/i)?.[1] ?? 0);
    const schema = atributos.match(/schema="([^"]+)"/i)?.[1] ?? null;
    try {
      saida.push({ nsu, schema, xml: gunzipBase64(m[2]) });
    } catch {
      // documento corrompido: ignorado deliberadamente
    }
  }
  return saida;
}

export interface RetornoDistribuicao {
  cStat: string | null;
  xMotivo: string | null;
  ultNSU: number;
  maxNSU: number;
  documentos: DocZip[];
}

export function parseDistribuicao(resposta: string): RetornoDistribuicao {
  return {
    cStat: pick(resposta, "cStat"),
    xMotivo: pick(resposta, "xMotivo"),
    ultNSU: Number(pick(resposta, "ultNSU") ?? 0),
    maxNSU: Number(pick(resposta, "maxNSU") ?? 0),
    documentos: extrairDocZips(resposta),
  };
}

export interface RetornoEvento {
  cStat: string | null;
  xMotivo: string | null;
  protocolo: string | null;
  sucesso: boolean;
}

export function parseEvento(resposta: string): RetornoEvento {
  const bloco = resposta.match(/<retEvento[\s\S]*?<\/retEvento>/i)?.[0] ?? resposta;
  const cStat = pick(bloco, "cStat");
  return {
    cStat,
    xMotivo: pick(bloco, "xMotivo"),
    protocolo: pick(bloco, "nProt"),
    sucesso: ["135", "136", "573"].includes(String(cStat ?? "")),
  };
}

export function escaparXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
