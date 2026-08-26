import https from "node:https";
import forge from "node-forge";
import { carregarConfig } from "./config.js";
import type { CertificadoUnidade } from "./cert.js";
import { classificarErro, log, sanitizar } from "./sanitize.js";
import { escaparXml, extrairSoapFault } from "./soap.js";
export { URL_DISTRIBUICAO, URL_EVENTO, URL_DISTRIBUICAO_HOM, URL_EVENTO_HOM, urlDistribuicao, urlEvento } from "./endpoints.js";

export const UF_CODIGO: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

export interface RespostaSoap {
  ok: boolean;
  status?: number;
  texto?: string;
  categoria?: string;
  detalhe?: string;
}

/**
 * POST SOAP com mTLS via módulo https do Node:
 * TLS 1.2 fixo (o IIS da SEFAZ exige), HTTP/1.1, sem keepAlive e sem reuso de sessão.
 */
export function soapPost(url: string, soap: string, cert: CertificadoUnidade, tentativas = 3): Promise<RespostaSoap> {
  const cfg = carregarConfig();

  const uma = (): Promise<RespostaSoap> =>
    new Promise((resolve) => {
      const alvo = new URL(url);
      const corpo = Buffer.from(soap, "utf8");
      const req = https.request(
        {
          host: alvo.hostname,
          port: alvo.port || 443,
          path: alvo.pathname + alvo.search,
          method: "POST",
          pfx: cert.pfx,
          passphrase: cert.senha,
          minVersion: "TLSv1.2",
          maxVersion: "TLSv1.2",
          secureOptions: 0,
          rejectUnauthorized: true,
          servername: alvo.hostname,
          agent: new https.Agent({ keepAlive: false, maxSockets: 1 }),
          timeout: cfg.timeoutMs,
          headers: {
            "Content-Type": "application/soap+xml; charset=utf-8",
            Accept: "application/soap+xml, text/xml",
            "Content-Length": corpo.length,
            Connection: "close",
          },
        },
        (res) => {
          const partes: Buffer[] = [];
          res.on("data", (c: Buffer) => partes.push(c));
          res.on("end", () => {
            const texto = Buffer.concat(partes).toString("utf8");
            const status = res.statusCode ?? 0;
            if (!texto) {
              resolve({ ok: false, status, categoria: "resposta_vazia", detalhe: `HTTP ${status} sem corpo` });
              return;
            }
            const fault = extrairSoapFault(texto);
            if (status >= 400 || fault) {
              resolve({
                ok: false,
                status,
                categoria: fault ? "soap_fault" : "http_erro",
                // `fault` já vem curto (só faultstring/Reason); sanitizar remove qualquer resíduo.
                detalhe: sanitizar(fault ? `HTTP ${status}: ${fault}` : `HTTP ${status}`),
              });
              return;
            }
            resolve({ ok: true, status, texto });
          });

        },
      );

      req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
      req.on("error", (e) => resolve({ ok: false, ...classificarErro(e) }));
      req.end(corpo);
    });

  return (async () => {
    let ultima: RespostaSoap = { ok: false, categoria: "rede_desconhecida", detalhe: "sem tentativa" };
    for (let t = 1; t <= tentativas; t++) {
      ultima = await uma();
      if (ultima.ok) {
        log.info("soap_ok", { host: new URL(url).host, tentativa: t, bytes: ultima.texto?.length ?? 0 });
        return ultima;
      }
      log.warn("soap_falha", { host: new URL(url).host, tentativa: t, categoria: ultima.categoria ?? "", detalhe: ultima.detalhe ?? "" });
      if (t < tentativas) await new Promise((r) => setTimeout(r, t * 1200));
    }
    return ultima;
  })();
}

export function envelope(acao: "dist" | "evento", conteudo: string): string {
  const wsdl = acao === "dist"
    ? `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${conteudo}</nfeDadosMsg></nfeDistDFeInteresse>`
    : `<nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg>${conteudo}</nfeDadosMsg></nfeRecepcaoEvento>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${wsdl}</soap12:Body></soap12:Envelope>`;
}

export function montarDistNSU(cnpj: string, cUF: string, ultNSU: number, tpAmb: string): string {
  return `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">` +
    `<tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${cnpj}</CNPJ>` +
    `<distNSU><ultNSU>${String(ultNSU).padStart(15, "0")}</ultNSU></distNSU></distDFeInt>`;
}

export function montarConsChNFe(cnpj: string, cUF: string, chave: string, tpAmb: string): string {
  return `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">` +
    `<tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${cnpj}</CNPJ>` +
    `<consChNFe><chNFe>${chave}</chNFe></consChNFe></distDFeInt>`;
}

export type TipoManifestacao = "ciencia" | "confirmada" | "desconhecida" | "nao_realizada";

export const CODIGO_EVENTO: Record<TipoManifestacao, string> = {
  confirmada: "210200", ciencia: "210210", desconhecida: "210220", nao_realizada: "210240",
};
export const DESCRICAO_EVENTO: Record<TipoManifestacao, string> = {
  confirmada: "Confirmacao da Operacao", ciencia: "Ciencia da Emissao",
  desconhecida: "Desconhecimento da Operacao", nao_realizada: "Operacao nao Realizada",
};
export const EXIGE_JUSTIFICATIVA: TipoManifestacao[] = ["desconhecida", "nao_realizada"];

function dataEventoISO(agora = new Date()): string {
  const brasilia = new Date(agora.getTime() - 3 * 3600 * 1000);
  return `${brasilia.toISOString().slice(0, 19)}-03:00`;
}

function assinar(infEventoXml: string, idEvento: string, cert: CertificadoUnidade): string {
  const md = forge.md.sha1.create();
  md.update(infEventoXml, "utf8");
  const digest = forge.util.encode64(md.digest().getBytes());

  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${idEvento}"><Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;

  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfo, "utf8");
  const assinatura = forge.util.encode64(cert.privateKey.sign(mdSig));

  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}` +
    `<SignatureValue>${assinatura}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cert.certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;
}

export function montarEnvEvento(
  cert: CertificadoUnidade,
  params: { chave: string; tipo: TipoManifestacao; justificativa?: string; sequencia: number; tpAmb: string },
): string {
  const { chave, tipo, justificativa = "", sequencia, tpAmb } = params;
  const idEvento = `ID${CODIGO_EVENTO[tipo]}${chave}${String(sequencia).padStart(2, "0")}`;
  const detEvento =
    `<detEvento versao="1.00"><descEvento>${DESCRICAO_EVENTO[tipo]}</descEvento>` +
    (EXIGE_JUSTIFICATIVA.includes(tipo) ? `<xJust>${escaparXml(justificativa)}</xJust>` : "") +
    `</detEvento>`;
  const infEvento =
    `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${idEvento}">` +
    `<cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cert.cnpjUnidade}</CNPJ><chNFe>${chave}</chNFe>` +
    `<dhEvento>${dataEventoISO()}</dhEvento><tpEvento>${CODIGO_EVENTO[tipo]}</tpEvento>` +
    `<nSeqEvento>${sequencia}</nSeqEvento><verEvento>1.00</verEvento>${detEvento}</infEvento>`;
  const evento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${infEvento}${assinar(infEvento, idEvento, cert)}</evento>`;
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${evento}</envEvento>`;
}
