import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extrairDocZips, extrairSoapFault, gunzipBase64, parseDistribuicao, parseEvento, pick } from "../src/soap.js";

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

describe("endpoints do Ambiente Nacional", () => {
  it("evento usa www (sem o 1) em produção e hom em homologação", async () => {
    const { URL_EVENTO, URL_DISTRIBUICAO, urlEvento, urlDistribuicao } = await import("../src/endpoints.js");
    expect(URL_EVENTO).toBe("https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx");
    expect(URL_DISTRIBUICAO).toContain("www1.nfe.fazenda.gov.br");
    expect(urlEvento("1")).toBe(URL_EVENTO);
    expect(urlEvento("2")).toContain("hom.nfe.fazenda.gov.br");
    expect(urlDistribuicao("2")).toContain("hom1.nfe.fazenda.gov.br");
  });
});

describe("SOAP Fault e retorno namespaceado", () => {
  const fault =
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><soap:Fault>` +
    `<soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code>` +
    `<soap:Reason><soap:Text xml:lang="pt">Rejeicao: Servico indisponivel</soap:Text></soap:Reason>` +
    `</soap:Fault></soap:Body></soap:Envelope>`;

  it("extrai apenas a descrição do Fault, sem devolver o envelope", () => {
    const d = extrairSoapFault(fault);
    expect(d).toBe("Rejeicao: Servico indisponivel");
    expect(d).not.toContain("<");
    expect(extrairSoapFault("<retEnvEvento><cStat>128</cStat></retEnvEvento>")).toBeNull();
  });

  it("parseEvento devolve motivo técnico em SOAP Fault", () => {
    const p = parseEvento(fault);
    expect(p.sucesso).toBe(false);
    expect(p.falhaSoap).toBe("Rejeicao: Servico indisponivel");
  });

  it("parseEvento lê retEvento com prefixo de namespace", () => {
    const xml =
      `<ns:retEnvEvento versao="1.00"><ns:idLote>1</ns:idLote><ns:cStat>128</ns:cStat>` +
      `<ns:retEvento versao="1.00"><ns:infEvento><ns:cStat>135</ns:cStat>` +
      `<ns:xMotivo>Evento registrado e vinculado a NF-e</ns:xMotivo><ns:nProt>891</ns:nProt>` +
      `</ns:infEvento></ns:retEvento></ns:retEnvEvento>`;
    expect(parseEvento(xml)).toMatchObject({ cStat: "135", protocolo: "891", sucesso: true });
  });

  it("parseEvento cai no retEnvEvento quando não há retEvento (rejeição de lote)", () => {
    const xml = `<ns2:retEnvEvento><ns2:cStat>492</ns2:cStat><ns2:xMotivo>Rejeicao: Assinatura invalida</ns2:xMotivo></ns2:retEnvEvento>`;
    expect(parseEvento(xml)).toMatchObject({ cStat: "492", xMotivo: "Rejeicao: Assinatura invalida", sucesso: false });
  });
});
