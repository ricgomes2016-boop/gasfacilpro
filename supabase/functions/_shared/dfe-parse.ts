// Parser DF-e para as edge functions (espelha src/lib/fiscal/dfeXml.ts,
// que é coberto por testes unitários no frontend).

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
  tipoEvento: string | null;
  descricaoEvento: string | null;
}

function tag(xml: string, nome: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, "i"));
  return m ? m[1].trim() : null;
}
function num(v: string | null): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function so44(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, 44);
}

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
    tipo: "desconhecido", chave: null, cnpjEmitente: null, nomeEmitente: null, ieEmitente: null,
    numero: null, serie: null, valorTotal: 0, dataEmissao: null, situacaoNfe: null,
    digestValue: null, tipoEvento: null, descricaoEvento: null,
  };
  if (!xml) return base;
  const chaveDireta = so44(tag(xml, "chNFe"));
  const chaveId = so44((xml.match(/Id="NFe(\d{44})"/i) || [])[1] || "");

  if (/<(?:\w+:)?resNFe[\s>]/i.test(xml)) {
    return {
      ...base, tipo: "resumo", chave: chaveDireta || null,
      cnpjEmitente: (tag(xml, "CNPJ") || "").replace(/\D/g, "") || null,
      nomeEmitente: tag(xml, "xNome"), ieEmitente: tag(xml, "IE"),
      numero: tag(xml, "nNF"), serie: tag(xml, "serie"),
      valorTotal: num(tag(xml, "vNF")), dataEmissao: tag(xml, "dhEmi"),
      situacaoNfe: situacaoPorCodigo(tag(xml, "cSitNFe")), digestValue: tag(xml, "digVal"),
    };
  }
  if (/<(?:\w+:)?resEvento[\s>]/i.test(xml) || /<(?:\w+:)?procEventoNFe[\s>]/i.test(xml)) {
    return {
      ...base, tipo: "evento", chave: chaveDireta || null,
      cnpjEmitente: (tag(xml, "CNPJ") || "").replace(/\D/g, "") || null,
      nomeEmitente: tag(xml, "xNome"), dataEmissao: tag(xml, "dhEvento"),
      tipoEvento: tag(xml, "tpEvento"), descricaoEvento: tag(xml, "xEvento") || tag(xml, "descEvento"),
    };
  }
  if (/<(?:\w+:)?infNFe[\s>]/i.test(xml)) {
    const emit = xml.match(/<(?:\w+:)?emit[^>]*>([\s\S]*?)<\/(?:\w+:)?emit>/i)?.[1] ?? "";
    const ide = xml.match(/<(?:\w+:)?ide[^>]*>([\s\S]*?)<\/(?:\w+:)?ide>/i)?.[1] ?? "";
    const tot = xml.match(/<(?:\w+:)?ICMSTot[^>]*>([\s\S]*?)<\/(?:\w+:)?ICMSTot>/i)?.[1] ?? "";
    return {
      ...base, tipo: "completo", chave: chaveId || chaveDireta || null,
      cnpjEmitente: (tag(emit, "CNPJ") || "").replace(/\D/g, "") || null,
      nomeEmitente: tag(emit, "xNome"), ieEmitente: tag(emit, "IE"),
      numero: tag(ide, "nNF"), serie: tag(ide, "serie"),
      valorTotal: num(tag(tot, "vNF")), dataEmissao: tag(ide, "dhEmi") || tag(ide, "dEmi"),
      situacaoNfe: /<(?:\w+:)?cStat>101</i.test(xml) ? "cancelada" : "autorizada",
      digestValue: tag(xml, "DigestValue"),
    };
  }
  return base;
}

export function deveAtualizarDocumento(
  existente: { tipo_documento?: string | null; nsu?: number | null } | null | undefined,
  novo: { tipo: DfeTipoDocumento; nsu?: number | null },
): boolean {
  if (!existente) return true;
  if (novo.tipo === "completo" && existente.tipo_documento !== "completo") return true;
  if (novo.tipo === "resumo" && existente.tipo_documento === "completo") return false;
  return Number(novo.nsu ?? 0) > Number(existente.nsu ?? 0);
}
