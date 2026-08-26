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
  /** Motivo técnico seguro quando a SEFAZ devolve SOAP Fault em vez de retEnvEvento. */
  falhaSoap?: string;
}

/**
 * Extrai apenas a descrição textual de um SOAP Fault (1.1 faultstring / 1.2 Reason>Text).
 * Nunca devolve o envelope inteiro — evita vazar XML, chave, CNPJ ou certificado nos logs.
 */
export function extrairSoapFault(xml: string): string | null {
  if (!/<(?:\w+:)?Fault[\s>]/i.test(xml)) return null;
  const texto = pick(xml, "faultstring") ?? pick(xml, "Text") ?? pick(xml, "faultcode") ?? null;
  const limpo = (texto ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, 200) : "SOAP Fault sem descrição";
}

export function parseEvento(resposta: string): RetornoEvento {
  const fault = extrairSoapFault(resposta);
  if (fault) {
    return { cStat: null, xMotivo: null, protocolo: null, sucesso: false, falhaSoap: fault };
  }
  // Prefere o retEvento individual; se ausente, cai no retEnvEvento do lote.
  const bloco =
    resposta.match(/<(?:\w+:)?retEvento[\s\S]*?<\/(?:\w+:)?retEvento>/i)?.[0] ??
    resposta.match(/<(?:\w+:)?retEnvEvento[\s\S]*?<\/(?:\w+:)?retEnvEvento>/i)?.[0] ??
    resposta;
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
