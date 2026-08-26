import { describe, expect, it, vi } from "vitest";
import { obterXmlCompletoDfe } from "./obterXmlCompleto";
import { formatarNumeroSerieComChave, numeroDaChave, serieDaChave } from "./chaveNfe";
import { parseDfeItens } from "./dfeXml";

const XML_COMPLETO = `<?xml version="1.0"?>
<nfeProc><NFe><infNFe Id="NFe35240612345678000199550010000001231000000012">
<ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-08-01T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor Teste</xNome></emit>
<det nItem="1"><prod><cProd>P13</cProd><xProd>GAS P13</xProd><uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>100.00</vUnCom><vProd>1000.00</vProd></prod></det>
<total><ICMSTot><vNF>1000.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

const XML_RESUMO = `<resNFe versao="1.01"><chNFe>35240612345678000199550010000001231000000012</chNFe>
<CNPJ>12345678000199</CNPJ><xNome>Fornecedor Teste</xNome><vNF>1000.00</vNF><cSitNFe>1</cSitNFe></resNFe>`;

const manifestacaoOk = {
  ok: true as const,
  dados: { eventoXml: "<evento/>", retornoXml: "<retorno/>", cStat: "135", xMotivo: "Evento registrado", protocolo: "1" },
};

describe("obterXmlCompletoDfe", () => {
  it("resumo -> ciência -> consulta -> XML completo com itens", async () => {
    const ingerirXml = vi.fn().mockResolvedValue({ ok: true });
    const ingerirEvento = vi.fn().mockResolvedValue({ ok: true });
    const r = await obterXmlCompletoDfe({
      registrarCiencia: true,
      manifestar: vi.fn().mockResolvedValue(manifestacaoOk),
      ingerirEvento,
      consultarChave: vi.fn().mockResolvedValue({ ok: true, dados: { xml: XML_COMPLETO, schema: "procNFe_v4.00.xsd" } }),
      ingerirXml,
    });
    expect(r.status).toBe("completo");
    expect(ingerirEvento).toHaveBeenCalledOnce();
    expect(ingerirXml).toHaveBeenCalledOnce();
    if (r.status === "completo") expect(parseDfeItens(r.xml)).toHaveLength(1);
  });

  it("SEFAZ ainda não liberou: devolve aguardando_liberacao e não ingere resumo", async () => {
    const ingerirXml = vi.fn();
    const r = await obterXmlCompletoDfe({
      registrarCiencia: true,
      manifestar: vi.fn().mockResolvedValue(manifestacaoOk),
      ingerirEvento: vi.fn().mockResolvedValue({ ok: true }),
      consultarChave: vi.fn().mockResolvedValue({ ok: true, dados: { xml: XML_RESUMO, schema: "resNFe_v1.01.xsd" } }),
      ingerirXml,
    });
    expect(r.status).toBe("aguardando_liberacao");
    expect(r.cienciaRegistrada).toBe(true);
    expect(ingerirXml).not.toHaveBeenCalled();
    if (r.status === "aguardando_liberacao") expect(r.mensagem).toMatch(/Buscar XML completo/);
  });

  it("nunca manifesta quando registrarCiencia = false", async () => {
    const manifestar = vi.fn();
    const r = await obterXmlCompletoDfe({
      registrarCiencia: false,
      manifestar,
      ingerirEvento: vi.fn(),
      consultarChave: vi.fn().mockResolvedValue({ ok: true, dados: { xml: XML_RESUMO, schema: null } }),
      ingerirXml: vi.fn(),
    });
    expect(manifestar).not.toHaveBeenCalled();
    expect(r.status).toBe("aguardando_liberacao");
    expect(r.cienciaRegistrada).toBe(false);
  });

  it("falha na ciência interrompe o fluxo sem consultar a chave", async () => {
    const consultarChave = vi.fn();
    const r = await obterXmlCompletoDfe({
      registrarCiencia: true,
      manifestar: vi.fn().mockResolvedValue({ ok: false, motivo: "token_invalido", mensagem: "Token inválido." }),
      ingerirEvento: vi.fn(),
      consultarChave,
      ingerirXml: vi.fn(),
    });
    expect(r.status).toBe("erro");
    expect(consultarChave).not.toHaveBeenCalled();
  });
});

describe("número/série derivados da chave", () => {
  const chave = "35240612345678000199550010000001231000000012";
  it("extrai série e número", () => {
    expect(serieDaChave(chave)).toBe("001");
    expect(numeroDaChave(chave)).toBe("000000123");
    expect(formatarNumeroSerieComChave(null, null, chave)).toBe("123/1");
  });
  it("prefere os valores reais quando existem", () => {
    expect(formatarNumeroSerieComChave("999", "2", chave)).toBe("999/2");
  });
  it("não inventa valores com chave inválida", () => {
    expect(formatarNumeroSerieComChave(null, null, "123")).toBe("S/N");
  });
});

describe("propagação de mensagem específica da SEFAZ", () => {
  it("repassa a falha SOAP/cStat vinda do agente em vez de mensagem genérica", async () => {
    const consultarChave = vi.fn();
    const r = await obterXmlCompletoDfe({
      registrarCiencia: true,
      manifestar: async () => ({
        ok: false as const,
        motivo: "soap_fault",
        mensagem: "A SEFAZ respondeu com falha SOAP: Rejeicao: Servico indisponivel",
      }),
      ingerirEvento: async () => ({ ok: true }),
      consultarChave,
      ingerirXml: async () => ({ ok: true }),
    });
    expect(r).toMatchObject({ status: "erro", motivo: "soap_fault" });
    expect(r.status === "erro" && r.mensagem).toContain("Rejeicao: Servico indisponivel");
    expect(consultarChave).not.toHaveBeenCalled();
  });
});
