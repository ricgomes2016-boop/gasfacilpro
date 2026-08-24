/**
 * Parser puro (baseado em regex, sem DOM) para os documentos retornados pelo
 * serviço NFeDistribuicaoDFe: resNFe (resumo), procNFe/nfeProc (XML completo)
 * e resEvento (eventos). Funciona no Deno (edge functions) e no Node (testes).
 */

import { normalizarChave } from "./chaveNfe";

export type DfeTipoDocumento = "resumo" | "completo" | "evento" | "desconhecido";

export interface DfeDocumentoParsed {
  tipo: DfeTipoDocumento;
  chave: string | null;
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  ieEmitente: string | null;
  numero: string | null;
  serie: string | null;
  valorTotal: number;
  dataEmissao: string | null;
  situacaoNfe: string | null;
  digestValue: string | null;
  /** Código do evento, quando o documento é um resEvento/procEventoNFe. */
  tipoEvento: string | null;
  descricaoEvento: string | null;
}

export interface DfeItemParsed {
  numero: number;
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cean: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

function tag(xml: string, nome: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, "i"));
  return m ? m[1].trim() : null;
}

function num(valor: string | null): number {
  const n = parseFloat(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Mapeia cSitNFe do resumo para uma situação legível. */
export function situacaoPorCodigo(cSit: string | null): string | null {
  switch (String(cSit ?? "").trim()) {
    case "1": return "autorizada";
    case "2": return "denegada";
    case "3": return "cancelada";
    default: return null;
  }
}

export function parseDfeDocumento(xml: string): DfeDocumentoParsed {
  const base: DfeDocumentoParsed = {
    tipo: "desconhecido",
    chave: null,
    cnpjEmitente: null,
    nomeEmitente: null,
    ieEmitente: null,
    numero: null,
    serie: null,
    valorTotal: 0,
    dataEmissao: null,
    situacaoNfe: null,
    digestValue: null,
    tipoEvento: null,
    descricaoEvento: null,
  };
  if (!xml) return base;

  const chaveDireta = normalizarChave(tag(xml, "chNFe"));
  const chaveId = normalizarChave((xml.match(/Id="NFe(\d{44})"/i) || [])[1] || "");

  if (/<(?:\w+:)?resNFe[\s>]/i.test(xml)) {
    return {
      ...base,
      tipo: "resumo",
      chave: chaveDireta || null,
      cnpjEmitente: (tag(xml, "CNPJ") || "").replace(/\D/g, "") || null,
      nomeEmitente: tag(xml, "xNome"),
      ieEmitente: tag(xml, "IE"),
      numero: tag(xml, "nNF"),
      serie: tag(xml, "serie"),
      valorTotal: num(tag(xml, "vNF")),
      dataEmissao: tag(xml, "dhEmi"),
      situacaoNfe: situacaoPorCodigo(tag(xml, "cSitNFe")),
      digestValue: tag(xml, "digVal"),
    };
  }

  if (/<(?:\w+:)?resEvento[\s>]/i.test(xml) || /<(?:\w+:)?procEventoNFe[\s>]/i.test(xml)) {
    return {
      ...base,
      tipo: "evento",
      chave: chaveDireta || null,
      cnpjEmitente: (tag(xml, "CNPJ") || "").replace(/\D/g, "") || null,
      nomeEmitente: tag(xml, "xNome"),
      dataEmissao: tag(xml, "dhEvento"),
      tipoEvento: tag(xml, "tpEvento"),
      descricaoEvento: tag(xml, "xEvento") || tag(xml, "descEvento"),
    };
  }

  if (/<(?:\w+:)?infNFe[\s>]/i.test(xml)) {
    const emitBloco = xml.match(/<(?:\w+:)?emit[^>]*>([\s\S]*?)<\/(?:\w+:)?emit>/i)?.[1] ?? "";
    const ideBloco = xml.match(/<(?:\w+:)?ide[^>]*>([\s\S]*?)<\/(?:\w+:)?ide>/i)?.[1] ?? "";
    const totalBloco = xml.match(/<(?:\w+:)?ICMSTot[^>]*>([\s\S]*?)<\/(?:\w+:)?ICMSTot>/i)?.[1] ?? "";
    return {
      ...base,
      tipo: "completo",
      chave: chaveId || chaveDireta || null,
      cnpjEmitente: (tag(emitBloco, "CNPJ") || "").replace(/\D/g, "") || null,
      nomeEmitente: tag(emitBloco, "xNome"),
      ieEmitente: tag(emitBloco, "IE"),
      numero: tag(ideBloco, "nNF"),
      serie: tag(ideBloco, "serie"),
      valorTotal: num(tag(totalBloco, "vNF")),
      dataEmissao: tag(ideBloco, "dhEmi") || tag(ideBloco, "dEmi"),
      situacaoNfe: /<(?:\w+:)?cStat>101</i.test(xml) ? "cancelada" : "autorizada",
      digestValue: tag(xml, "DigestValue"),
    };
  }

  return base;
}

/** Extrai os itens de um XML completo (nfeProc/NFe). */
export function parseDfeItens(xml: string): DfeItemParsed[] {
  if (!xml) return [];
  const itens: DfeItemParsed[] = [];
  const re = /<(?:\w+:)?det[^>]*nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const bloco = m[2];
    const prod = bloco.match(/<(?:\w+:)?prod[^>]*>([\s\S]*?)<\/(?:\w+:)?prod>/i)?.[1] ?? "";
    itens.push({
      numero: Number(m[1]) || itens.length + 1,
      codigo: tag(prod, "cProd"),
      descricao: tag(prod, "xProd") ?? "",
      ncm: tag(prod, "NCM"),
      cean: (tag(prod, "cEAN") || "").replace(/^SEM GTIN$/i, "") || null,
      cfop: tag(prod, "CFOP"),
      unidade: tag(prod, "uCom"),
      quantidade: num(tag(prod, "qCom")),
      valorUnitario: num(tag(prod, "vUnCom")),
      valorTotal: num(tag(prod, "vProd")),
    });
  }
  return itens;
}

/**
 * Deduplicação/idempotência: dado o documento já gravado e o recém-recebido,
 * decide se o novo deve substituir o anterior (resumo nunca sobrescreve completo).
 */
export function deveAtualizarDocumento(
  existente: { tipo_documento?: string | null; nsu?: number | null } | null | undefined,
  novo: { tipo: DfeTipoDocumento; nsu?: number | null },
): boolean {
  if (!existente) return true;
  if (novo.tipo === "completo" && existente.tipo_documento !== "completo") return true;
  if (novo.tipo === "resumo" && existente.tipo_documento === "completo") return false;
  const nsuExistente = Number(existente.nsu ?? 0);
  const nsuNovo = Number(novo.nsu ?? 0);
  return nsuNovo > nsuExistente;
}
