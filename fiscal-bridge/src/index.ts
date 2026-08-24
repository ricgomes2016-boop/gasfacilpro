import http from "node:http";
import { carregarConfig } from "./config.js";
import { RegistroNonce, verificarAssinatura } from "./hmac.js";
import { log, mascarar, sanitizar } from "./sanitize.js";
import { carregarCertificado, carregarCertificadoLocal, descartarCertificado, type CertificadoUnidade } from "./cert.js";
import {
  UF_CODIGO, URL_DISTRIBUICAO, URL_EVENTO, CODIGO_EVENTO, EXIGE_JUSTIFICATIVA,
  envelope, montarConsChNFe, montarDistNSU, montarEnvEvento, soapPost, type TipoManifestacao,
} from "./sefaz.js";
import { parseDistribuicao, parseEvento } from "./soap.js";

const cfg = carregarConfig();
const nonces = new RegistroNonce();
const MODO_LOCAL = cfg.modo === "local";

const LIMITE_CORPO = 256 * 1024;

/** No modo local a página HTTPS do ERP chama http://127.0.0.1 — exige CORS explícito. */
function cabecalhosCors(origem: string | undefined): Record<string, string> {
  if (!MODO_LOCAL) return {};
  const permitidas = cfg.local?.origens ?? [];
  const alvo = (origem ?? "").replace(/\/+$/, "");
  if (!alvo || !permitidas.includes(alvo)) return {};
  return {
    "Access-Control-Allow-Origin": alvo,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-agente-token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function responder(res: http.ServerResponse, status: number, corpo: unknown, cors: Record<string, string> = {}) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors });
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
  const carga = MODO_LOCAL ? carregarCertificadoLocal() : await carregarCertificado(unidadeId);
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
  const cors = cabecalhosCors(req.headers.origin as string | undefined);

  if (MODO_LOCAL && req.method === "OPTIONS") {
    res.writeHead(Object.keys(cors).length ? 204 : 403, cors);
    res.end();
    return;
  }

  if (req.method === "GET" && caminho === "/health") {
    responder(res, 200, {
      ok: true,
      servico: "fiscal-bridge",
      modo: cfg.modo,
      cnpj: MODO_LOCAL ? cfg.local?.cnpj : undefined,
      ambiente: cfg.tpAmb === "1" ? "producao" : "homologacao",
    }, cors);
    return;
  }

  if (req.method !== "POST") {
    responder(res, 405, { ok: false, motivo: "metodo_nao_permitido" }, cors);
    return;
  }

  if (MODO_LOCAL && !Object.keys(cors).length && req.headers.origin) {
    responder(res, 403, { ok: false, motivo: "origem_nao_autorizada", mensagem: "Origem não autorizada pelo agente." });
    return;
  }

  let corpoBruto = "";
  try {
    corpoBruto = await lerCorpo(req);
  } catch {
    responder(res, 413, { ok: false, motivo: "corpo_invalido" }, cors);
    return;
  }

  if (MODO_LOCAL) {
    // Modo local: pareamento por token (a assinatura HMAC vale só no modo servidor).
    const token = String(req.headers["x-agente-token"] ?? "");
    if (!token || token !== cfg.local?.token) {
      log.warn("token_recusado", { caminho });
      responder(res, 401, { ok: false, motivo: "token_invalido", mensagem: "Token do agente local inválido." }, cors);
      return;
    }
    if (caminho === "/dfe/manifestar") {
      responder(res, 403, { ok: false, motivo: "manifestacao_desabilitada", mensagem: "O agente local só consulta e baixa documentos." }, cors);
      return;
    }
  } else {
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
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(corpoBruto || "{}");
  } catch {
    responder(res, 400, { ok: false, motivo: "json_invalido" }, cors);
    return;
  }

  const unidadeId = String(body.unidadeId ?? (MODO_LOCAL ? "local" : ""));
  if (!unidadeId) {
    responder(res, 400, { ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." }, cors);
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
      responder(res, 200, resultado, cors);
      return;
    }

    if (caminho === "/dfe/consulta-chave") {
      const chave = validarChave(body.chave);
      if (!chave) {
        responder(res, 400, { ok: false, motivo: "chave_invalida", mensagem: "A chave deve ter 44 dígitos." }, cors);
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
      responder(res, 200, resultado, cors);
      return;
    }

    if (caminho === "/dfe/manifestar") {
      const chave = validarChave(body.chave);
      const tipo = String(body.tipo ?? "") as TipoManifestacao;
      const justificativa = String(body.justificativa ?? "").trim();
      const sequencia = Math.max(1, Number(body.sequencia ?? 1));
      if (!chave) {
        responder(res, 400, { ok: false, motivo: "chave_invalida", mensagem: "A chave deve ter 44 dígitos." }, cors);
        return;
      }
      if (!CODIGO_EVENTO[tipo]) {
        responder(res, 400, { ok: false, motivo: "tipo_invalido", mensagem: "Tipo de manifestação inválido." }, cors);
        return;
      }
      if (EXIGE_JUSTIFICATIVA.includes(tipo) && (justificativa.length < 15 || justificativa.length > 255)) {
        responder(res, 400, { ok: false, motivo: "justificativa_invalida", mensagem: "Justificativa entre 15 e 255 caracteres." }, cors);
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
      responder(res, 200, resultado, cors);
      return;
    }

    responder(res, 404, { ok: false, motivo: "rota_desconhecida" }, cors);
  } catch (e) {
    log.error("excecao", { caminho, detalhe: sanitizar(e) });
    responder(res, 200, { ok: false, motivo: "exception", mensagem: "Erro interno no bridge fiscal." }, cors);
  }
});

servidor.listen(cfg.porta, () => log.info("bridge_online", { porta: cfg.porta }));
