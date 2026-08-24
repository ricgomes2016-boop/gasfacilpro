import http from "node:http";
import { carregarConfig } from "./config.js";
import { RegistroNonce, verificarAssinatura } from "./hmac.js";
import { log, mascarar, sanitizar } from "./sanitize.js";
import { carregarCertificado, descartarCertificado, type CertificadoUnidade } from "./cert.js";
import {
  UF_CODIGO, URL_DISTRIBUICAO, URL_EVENTO, CODIGO_EVENTO, EXIGE_JUSTIFICATIVA,
  envelope, montarConsChNFe, montarDistNSU, montarEnvEvento, soapPost, type TipoManifestacao,
} from "./sefaz.js";
import { parseDistribuicao, parseEvento } from "./soap.js";

const cfg = carregarConfig();
const nonces = new RegistroNonce();

const LIMITE_CORPO = 256 * 1024;

function responder(res: http.ServerResponse, status: number, corpo: unknown) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(texto);
}

function lerCorpo(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const partes: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > LIMITE_CORPO) {
        reject(new Error("corpo_muito_grande"));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}

function cUFDe(cert: CertificadoUnidade, chave?: string): string {
  return UF_CODIGO[String(cert.estado ?? "").toUpperCase()] || chave?.slice(0, 2) || "41";
}

function validarChave(v: unknown): string | null {
  const chave = String(v ?? "").replace(/\D/g, "");
  return chave.length === 44 ? chave : null;
}

async function comCertificado<T>(
  unidadeId: string,
  cnpjEsperado: string | null,
  fn: (cert: CertificadoUnidade) => Promise<T>,
): Promise<T | { ok: false; motivo: string; mensagem: string }> {
  const carga = await carregarCertificado(unidadeId);
  if (!carga.ok) return { ok: false, motivo: carga.motivo, mensagem: carga.mensagem };
  const cnpj = String(cnpjEsperado ?? "").replace(/\D/g, "");
  if (cnpj && cnpj !== carga.cert.cnpjUnidade) {
    descartarCertificado(carga.cert);
    return {
      ok: false,
      motivo: "cnpj_divergente",
      mensagem: "O CNPJ informado não corresponde ao certificado/unidade.",
    };
  }
  try {
    return await fn(carga.cert);
  } finally {
    descartarCertificado(carga.cert);
  }
}

const servidor = http.createServer(async (req, res) => {
  const caminho = (req.url ?? "/").split("?")[0];

  if (req.method === "GET" && caminho === "/health") {
    responder(res, 200, { ok: true, servico: "fiscal-bridge", ambiente: cfg.tpAmb === "1" ? "producao" : "homologacao" });
    return;
  }

  if (req.method !== "POST") {
    responder(res, 405, { ok: false, motivo: "metodo_nao_permitido" });
    return;
  }

  let corpoBruto = "";
  try {
    corpoBruto = await lerCorpo(req);
  } catch {
    responder(res, 413, { ok: false, motivo: "corpo_invalido" });
    return;
  }

  const verificacao = verificarAssinatura(
    {
      segredo: cfg.segredoHmac,
      timestamp: req.headers["x-bridge-timestamp"] as string,
      nonce: req.headers["x-bridge-nonce"] as string,
      assinatura: req.headers["x-bridge-signature"] as string,
      caminho,
      corpo: corpoBruto,
    },
    nonces,
  );
  if (!verificacao.ok) {
    log.warn("assinatura_recusada", { caminho, motivo: verificacao.motivo });
    responder(res, 401, { ok: false, motivo: verificacao.motivo, mensagem: "Requisição não autorizada." });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(corpoBruto || "{}");
  } catch {
    responder(res, 400, { ok: false, motivo: "json_invalido" });
    return;
  }

  const unidadeId = String(body.unidadeId ?? "");
  if (!unidadeId) {
    responder(res, 400, { ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    return;
  }
  const cnpjInformado = body.cnpj ? String(body.cnpj) : null;

  try {
    if (caminho === "/dfe/distribuicao") {
      const ultNSU = Number(body.ultNSU ?? 0);
      const resultado = await comCertificado(unidadeId, cnpjInformado, async (cert) => {
        const soap = envelope("dist", montarDistNSU(cert.cnpjUnidade, cUFDe(cert), ultNSU, cfg.tpAmb));
        const resp = await soapPost(URL_DISTRIBUICAO, soap, cert);
        if (!resp.ok) return { ok: false as const, motivo: resp.categoria ?? "sefaz_indisponivel", mensagem: "Não foi possível falar com a SEFAZ.", detalheTecnico: sanitizar(resp.detalhe) };
        const p = parseDistribuicao(resp.texto ?? "");
        log.info("distribuicao", { unidade: mascarar(unidadeId), docs: p.documentos.length, cStat: p.cStat ?? "" });
        return { ok: true as const, ...p };
      });
      responder(res, 200, resultado);
      return;
    }

    if (caminho === "/dfe/consulta-chave") {
      const chave = validarChave(body.chave);
      if (!chave) {
        responder(res, 400, { ok: false, motivo: "chave_invalida", mensagem: "A chave deve ter 44 dígitos." });
        return;
      }
      const resultado = await comCertificado(unidadeId, cnpjInformado, async (cert) => {
        const soap = envelope("dist", montarConsChNFe(cert.cnpjUnidade, cUFDe(cert, chave), chave, cfg.tpAmb));
        const resp = await soapPost(URL_DISTRIBUICAO, soap, cert);
        if (!resp.ok) return { ok: false as const, motivo: resp.categoria ?? "sefaz_indisponivel", mensagem: "Não foi possível falar com a SEFAZ.", detalheTecnico: sanitizar(resp.detalhe) };
        const p = parseDistribuicao(resp.texto ?? "");
        const doc = p.documentos[0];
        if (!doc) {
          return {
            ok: false as const,
            motivo: "nfe_nao_disponivel",
            cStat: p.cStat,
            xMotivo: p.xMotivo,
            podeRepetir: ["108", "109", "656"].includes(String(p.cStat ?? "")),
            mensagem: p.xMotivo ?? "A SEFAZ não retornou o documento desta chave.",
          };
        }
        const completo = /<infNFe/i.test(doc.xml);
        return {
          ok: true as const, chave, cStat: p.cStat, xMotivo: p.xMotivo,
          schema: doc.schema, completo, xml: doc.xml, titular: cert.titular,
        };
      });
      responder(res, 200, resultado);
      return;
    }

    if (caminho === "/dfe/manifestar") {
      const chave = validarChave(body.chave);
      const tipo = String(body.tipo ?? "") as TipoManifestacao;
      const justificativa = String(body.justificativa ?? "").trim();
      const sequencia = Math.max(1, Number(body.sequencia ?? 1));
      if (!chave) {
        responder(res, 400, { ok: false, motivo: "chave_invalida", mensagem: "A chave deve ter 44 dígitos." });
        return;
      }
      if (!CODIGO_EVENTO[tipo]) {
        responder(res, 400, { ok: false, motivo: "tipo_invalido", mensagem: "Tipo de manifestação inválido." });
        return;
      }
      if (EXIGE_JUSTIFICATIVA.includes(tipo) && (justificativa.length < 15 || justificativa.length > 255)) {
        responder(res, 400, { ok: false, motivo: "justificativa_invalida", mensagem: "Justificativa entre 15 e 255 caracteres." });
        return;
      }
      const resultado = await comCertificado(unidadeId, cnpjInformado, async (cert) => {
        const env = montarEnvEvento(cert, { chave, tipo, justificativa, sequencia, tpAmb: cfg.tpAmb });
        const resp = await soapPost(URL_EVENTO, envelope("evento", env), cert);
        if (!resp.ok) return { ok: false as const, motivo: resp.categoria ?? "sefaz_indisponivel", mensagem: "Não foi possível falar com a SEFAZ.", detalheTecnico: sanitizar(resp.detalhe) };
        const p = parseEvento(resp.texto ?? "");
        log.info("manifestacao", { unidade: mascarar(unidadeId), tipo, cStat: p.cStat ?? "", sucesso: p.sucesso });
        return { ok: p.sucesso, cStat: p.cStat, xMotivo: p.xMotivo, protocolo: p.protocolo, tipo, sequencia, motivo: p.sucesso ? undefined : "evento_rejeitado" };
      });
      responder(res, 200, resultado);
      return;
    }

    responder(res, 404, { ok: false, motivo: "rota_desconhecida" });
  } catch (e) {
    log.error("excecao", { caminho, detalhe: sanitizar(e) });
    responder(res, 200, { ok: false, motivo: "exception", mensagem: "Erro interno no bridge fiscal." });
  }
});

servidor.listen(cfg.porta, () => log.info("bridge_online", { porta: cfg.porta }));
