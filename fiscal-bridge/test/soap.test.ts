import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extrairDocZips, gunzipBase64, parseDistribuicao, parseEvento, pick } from "../src/soap.js";

const zipar = (xml: string) => gzipSync(Buffer.from(xml, "utf8")).toString("base64");

describe("parsing SOAP / gzip / base64", () => {
  it("lê tags com e sem prefixo de namespace", () => {
    expect(pick("<ns:cStat>138</ns:cStat>", "cStat")).toBe("138");
    expect(pick("<xMotivo>Documento localizado</xMotivo>", "xMotivo")).toBe("Documento localizado");
  });

  it("descompacta docZip gzip+base64", () => {
    expect(gunzipBase64(zipar("<resNFe><chNFe>1</chNFe></resNFe>"))).toContain("resNFe");
  });

  it("extrai vários docZip e ignora corrompidos", () => {
    const resposta =
      `<docZip NSU="000000000000001" schema="resNFe_v1.01">${zipar("<resNFe/>")}</docZip>` +
      `<docZip NSU="000000000000002" schema="procNFe_v4.00">NAOEHGZIP</docZip>`;
    const docs = extrairDocZips(resposta);
    expect(docs).toHaveLength(1);
    expect(docs[0].nsu).toBe(1);
    expect(docs[0].schema).toBe("resNFe_v1.01");
  });

  it("interpreta o retorno de distribuição", () => {
    const resposta =
      `<retDistDFeInt><cStat>138</cStat><xMotivo>Documento(s) localizado(s)</xMotivo>` +
      `<ultNSU>000000000000010</ultNSU><maxNSU>000000000000042</maxNSU>` +
      `<loteDistDFeInt><docZip NSU="000000000000010">${zipar("<resNFe/>")}</docZip></loteDistDFeInt></retDistDFeInt>`;
    const p = parseDistribuicao(resposta);
    expect(p).toMatchObject({ cStat: "138", ultNSU: 10, maxNSU: 42 });
    expect(p.documentos).toHaveLength(1);
  });

  it("interpreta evento aceito e rejeitado", () => {
    const aceito = "<retEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><nProt>141</nProt></retEvento>";
    expect(parseEvento(aceito)).toMatchObject({ sucesso: true, protocolo: "141" });
    const rejeitado = "<retEvento><cStat>573</cStat><xMotivo>Duplicidade</xMotivo></retEvento>";
    expect(parseEvento(rejeitado).sucesso).toBe(true);
    const erro = "<retEvento><cStat>594</cStat><xMotivo>Rejeicao</xMotivo></retEvento>";
    expect(parseEvento(erro).sucesso).toBe(false);
  });
});
