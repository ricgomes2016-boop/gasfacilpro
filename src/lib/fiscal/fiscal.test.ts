import { describe, it, expect } from "vitest";
import {
  normalizarChave,
  calcularDvChave,
  validarChaveNfe,
  extrairInfoChave,
  formatarChave,
} from "./chaveNfe";
import {
  manifestacoesPermitidas,
  podeManifestar,
  exigeJustificativa,
  validarJustificativa,
  tipoPorCodigo,
  CODIGO_EVENTO,
  eventoRegistradoComSucesso,
} from "./manifestacao";
import { parseDfeDocumento, parseDfeItens, deveAtualizarDocumento, situacaoPorCodigo } from "./dfeXml";

// Chave real de estrutura válida: base de 43 dígitos + DV calculado.
const BASE43 = "4126081234567800011255001000001234100000123";
const DV = calcularDvChave(BASE43)!;
const CHAVE_VALIDA = `${BASE43}${DV}`;

describe("chaveNfe", () => {
  it("normaliza removendo máscara e limitando a 44 dígitos", () => {
    expect(normalizarChave(" 4126.0812/3456 ")).toBe("4126081234 56".replace(/\D/g, ""));
    expect(normalizarChave(`${CHAVE_VALIDA}9999`)).toHaveLength(44);
    expect(normalizarChave(null)).toBe("");
  });

  it("calcula o DV por módulo 11", () => {
    expect(calcularDvChave(BASE43)).toBe(DV);
    expect(calcularDvChave("123")).toBeNull();
  });

  it("valida a chave completa e rejeita DV incorreto", () => {
    expect(validarChaveNfe(CHAVE_VALIDA)).toBe(true);
    const dvErrado = `${BASE43}${(DV + 1) % 10}`;
    expect(validarChaveNfe(dvErrado)).toBe(false);
    expect(validarChaveNfe("123")).toBe(false);
  });

  it("extrai os campos da chave", () => {
    const info = extrairInfoChave(CHAVE_VALIDA)!;
    expect(info.uf).toBe("PR");
    expect(info.ano).toBe("26");
    expect(info.mes).toBe("08");
    expect(info.cnpjEmitente).toBe("12345678000112");
    expect(info.modelo).toBe("55");
    expect(info.dvValido).toBe(true);
    expect(extrairInfoChave("123")).toBeNull();
  });

  it("formata em blocos de 4", () => {
    expect(formatarChave(CHAVE_VALIDA).split(" ")).toHaveLength(11);
  });
});

describe("máquina de estados da manifestação", () => {
  it("oferece as quatro manifestações quando não há nenhuma", () => {
    expect(manifestacoesPermitidas(null)).toEqual([
      "ciencia", "confirmada", "desconhecida", "nao_realizada",
    ]);
  });

  it("após Ciência oferece apenas as conclusivas", () => {
    expect(manifestacoesPermitidas("ciencia")).toEqual(["confirmada", "desconhecida", "nao_realizada"]);
    expect(podeManifestar("ciencia", "ciencia").permitido).toBe(false);
    expect(podeManifestar("ciencia", "confirmada").permitido).toBe(true);
  });

  it("bloqueia novas manifestações após manifestação conclusiva", () => {
    for (const atual of ["confirmada", "desconhecida", "nao_realizada"] as const) {
      expect(manifestacoesPermitidas(atual)).toEqual([]);
      expect(podeManifestar(atual, "ciencia").permitido).toBe(false);
      expect(podeManifestar(atual, "confirmada").motivo).toBeTruthy();
    }
  });

  it("exige justificativa apenas para desconhecimento e operação não realizada", () => {
    expect(exigeJustificativa("desconhecida")).toBe(true);
    expect(exigeJustificativa("nao_realizada")).toBe(true);
    expect(exigeJustificativa("ciencia")).toBe(false);
    expect(validarJustificativa("ciencia").valido).toBe(true);
    expect(validarJustificativa("desconhecida", "curta").valido).toBe(false);
    expect(validarJustificativa("desconhecida", "Mercadoria nunca foi recebida nesta unidade").valido).toBe(true);
    expect(validarJustificativa("nao_realizada", "x".repeat(256)).valido).toBe(false);
  });

  it("mapeia códigos oficiais", () => {
    expect(CODIGO_EVENTO.confirmada).toBe("210200");
    expect(tipoPorCodigo("210210")).toBe("ciencia");
    expect(tipoPorCodigo("999")).toBeNull();
    expect(eventoRegistradoComSucesso("135")).toBe(true);
    expect(eventoRegistradoComSucesso("573")).toBe(true);
    expect(eventoRegistradoComSucesso("999")).toBe(false);
  });
});

const RES_NFE = `<resNFe versao="1.01"><chNFe>${CHAVE_VALIDA}</chNFe><CNPJ>12345678000112</CNPJ>
<xNome>Distribuidora Exemplo LTDA</xNome><IE>1234567890</IE><dhEmi>2026-08-10T09:30:00-03:00</dhEmi>
<tpNF>1</tpNF><vNF>1520.55</vNF><digVal>abc==</digVal><dhRecbto>2026-08-10T10:00:00-03:00</dhRecbto>
<nNF>4567</nNF><serie>1</serie><cSitNFe>1</cSitNFe></resNFe>`;

const NFE_PROC = `<nfeProc versao="4.00"><NFe><infNFe Id="NFe${CHAVE_VALIDA}" versao="4.00">
<ide><nNF>4567</nNF><serie>1</serie><dhEmi>2026-08-10T09:30:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000112</CNPJ><xNome>Distribuidora Exemplo LTDA</xNome><IE>1234567890</IE></emit>
<det nItem="1"><prod><cProd>P13</cProd><cEAN>7891234567895</cEAN><xProd>GLP 13KG</xProd>
<NCM>27111910</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>100.0000</qCom>
<vUnCom>90.5000</vUnCom><vProd>9050.00</vProd></prod></det>
<det nItem="2"><prod><cProd>AG20</cProd><cEAN>SEM GTIN</cEAN><xProd>AGUA MINERAL 20L</xProd>
<NCM>22011000</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>10</qCom>
<vUnCom>8.00</vUnCom><vProd>80.00</vProd></prod></det>
<total><ICMSTot><vNF>9130.00</vNF></ICMSTot></total></infNFe></NFe>
<protNFe><infProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;

describe("parser DF-e", () => {
  it("interpreta um resumo (resNFe)", () => {
    const d = parseDfeDocumento(RES_NFE);
    expect(d.tipo).toBe("resumo");
    expect(d.chave).toBe(CHAVE_VALIDA);
    expect(d.nomeEmitente).toBe("Distribuidora Exemplo LTDA");
    expect(d.valorTotal).toBeCloseTo(1520.55);
    expect(d.situacaoNfe).toBe("autorizada");
    expect(d.numero).toBe("4567");
  });

  it("interpreta o XML completo e seus itens", () => {
    const d = parseDfeDocumento(NFE_PROC);
    expect(d.tipo).toBe("completo");
    expect(d.chave).toBe(CHAVE_VALIDA);
    expect(d.valorTotal).toBeCloseTo(9130);
    const itens = parseDfeItens(NFE_PROC);
    expect(itens).toHaveLength(2);
    expect(itens[0].descricao).toBe("GLP 13KG");
    expect(itens[0].cean).toBe("7891234567895");
    expect(itens[0].quantidade).toBe(100);
    expect(itens[1].cean).toBeNull();
  });

  it("interpreta resumo de evento", () => {
    const d = parseDfeDocumento(
      `<resEvento versao="1.01"><chNFe>${CHAVE_VALIDA}</chNFe><tpEvento>210210</tpEvento><xEvento>Ciencia da Operacao</xEvento></resEvento>`,
    );
    expect(d.tipo).toBe("evento");
    expect(d.tipoEvento).toBe("210210");
  });

  it("mapeia a situação da NF-e", () => {
    expect(situacaoPorCodigo("1")).toBe("autorizada");
    expect(situacaoPorCodigo("3")).toBe("cancelada");
    expect(situacaoPorCodigo("9")).toBeNull();
  });
});

describe("idempotência/deduplicação", () => {
  it("insere quando não existe", () => {
    expect(deveAtualizarDocumento(null, { tipo: "resumo", nsu: 10 })).toBe(true);
  });

  it("resumo nunca sobrescreve XML completo", () => {
    expect(deveAtualizarDocumento({ tipo_documento: "completo", nsu: 5 }, { tipo: "resumo", nsu: 90 })).toBe(false);
  });

  it("completo sobrescreve resumo", () => {
    expect(deveAtualizarDocumento({ tipo_documento: "resumo", nsu: 90 }, { tipo: "completo", nsu: 12 })).toBe(true);
  });

  it("ignora reprocessamento do mesmo NSU", () => {
    expect(deveAtualizarDocumento({ tipo_documento: "resumo", nsu: 90 }, { tipo: "resumo", nsu: 90 })).toBe(false);
  });
});
