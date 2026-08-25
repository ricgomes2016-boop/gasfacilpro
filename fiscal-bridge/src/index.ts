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
import { cabecalhosCorsLocal, mascararCnpj, tokensIguais } from "./local.js";
import { conferirComprovante, gerarComprovante } from "./comprovante.js";

const cfg = carregarConfig();
const nonces = new RegistroNonce();
const MODO_LOCAL = cfg.modo === "local";

const LIMITE_CORPO = 256 * 1024;

/** No modo local a página HTTPS do ERP chama http://127.0.0.1 — exige CORS explícito. */
function cabecalhosCors(origem: string | undefined): Record<string, string> {
  if (!MODO_LOCAL) return {};
  return cabecalhosCorsLocal(origem, cfg.local?.origens ?? []);
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

/** Extrai o primeiro elemento <tag>...</tag> (com ou sem prefixo de namespace). */
function extrair(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}[\\s>][\\s\\S]*?<\\/(?:\\w+:)?${tag}>`, "i");
  return xml.match(re)?.[0] ?? null;
}

function esperadoToken(): string {
  try {
    return cfg.local?.lerToken() ?? "";
  } catch {
    return "";
  }
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
    // No modo local o /health só é legível por origem autorizada (CORS obrigatório)
    // e nunca revela o CNPJ completo.
    if (MODO_LOCAL && !Object.keys(cors).length) {
      responder(res, 403, { ok: false, motivo: "origem_nao_autorizada", mensagem: "Origem não autorizada pelo agente." });
      return;
    }
    responder(res, 200, {
      ok: true,
      servico: "fiscal-bridge",
      modo: cfg.modo,
      cnpj: MODO_LOCAL ? mascararCnpj(cfg.local?.cnpj) : undefined,
      uf: MODO_LOCAL ? cfg.local?.uf : undefined,
      manifestacao: MODO_LOCAL ? true : undefined,
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
    let esperado = "";
    try {
      esperado = cfg.local?.lerToken() ?? "";
    } catch (e) {
      log.error("token_protegido_indisponivel", { detalhe: sanitizar(e) });
      responder(res, 500, { ok: false, motivo: "token_indisponivel", mensagem: "Não foi possível ler o token protegido. Rode scripts/instalar.ps1 -Reparar." }, cors);
      return;
    }
    if (!tokensIguais(token, esperado)) {
      log.warn("token_recusado", { caminho });
      responder(res, 401, { ok: false, motivo: "token_invalido", mensagem: "Token do agente local inválido." }, cors);
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

        // O XML do evento assinado (XMLDSig com o A1) é a prova que a nuvem consegue
        // validar sozinha — o navegador não tem a chave privada e não pode forjá-lo.
        const eventoXml = extrair(env, "evento");
        const retornoXml = extrair(resp.texto ?? "", "retEvento");
        const dhResposta = new Date().toISOString();
        const comprovanteLocal = gerarComprovante(
          { chave, tipo, cStat: String(p.cStat ?? ""), protocolo: String(p.protocolo ?? ""), dhResposta },
          esperadoToken(),
        );
        return {
          ok: p.sucesso,
          cStat: p.cStat,
          xMotivo: p.xMotivo,
          protocolo: p.protocolo,
          tipo,
          sequencia,
          dhResposta,
          eventoXml,
          retornoXml,
          comprovanteLocal,
          motivo: p.sucesso ? undefined : "evento_rejeitado",
        };
      });
      responder(res, 200, resultado, cors);
      return;
    }

    if (caminho === "/diagnostico") {
      // Autenticado pelo token (já validado acima). Nunca devolve CNPJ completo,
      // caminho de PFX, senha ou token.
      const carga = MODO_LOCAL ? carregarCertificadoLocal() : { ok: false as const, motivo: "modo_servidor", mensagem: "Diagnóstico disponível apenas no modo local." };
      const info = carga.ok
        ? {
          certificado: "ok",
          titular: carga.cert.titular,
          validade: carga.cert.validade.toISOString().slice(0, 10),
          cnpj: mascararCnpj(carga.cert.cnpjUnidade),
        }
        : { certificado: "falha", motivo: carga.motivo, mensagem: carga.mensagem };
      if (carga.ok) descartarCertificado(carga.cert);

      const conferencia = body.comprovante
        ? conferirComprovante(
          {
            chave: String(body.chave ?? ""),
            tipo: String(body.tipo ?? ""),
            cStat: String(body.cStat ?? ""),
            protocolo: String(body.protocolo ?? ""),
            dhResposta: String(body.dhResposta ?? ""),
          },
          esperadoToken(),
          String(body.comprovante),
        )
        : undefined;

      responder(res, 200, {
        ok: true,
        modo: cfg.modo,
        ambiente: cfg.tpAmb === "1" ? "producao" : "homologacao",
        porta: cfg.porta,
        uf: MODO_LOCAL ? cfg.local?.uf : undefined,
        origensAutorizadas: MODO_LOCAL ? (cfg.local?.origens.length ?? 0) : undefined,
        node: process.versions.node,
        plataforma: process.platform,
        ...info,
        comprovanteConfere: conferencia,
      }, cors);
      return;
    }

    responder(res, 404, { ok: false, motivo: "rota_desconhecida" }, cors);
  } catch (e) {
    log.error("excecao", { caminho, detalhe: sanitizar(e) });
    responder(res, 200, { ok: false, motivo: "exception", mensagem: "Erro interno no bridge fiscal." }, cors);
  }
});

// Modo local: escuta SOMENTE no loopback (nunca 0.0.0.0/::), para o agente não
// ficar exposto na rede do escritório. Modo servidor mantém o bind padrão.
if (MODO_LOCAL) {
  servidor.listen(cfg.porta, "127.0.0.1", () => log.info("bridge_online", { porta: cfg.porta, host: "127.0.0.1" }));
} else {
  servidor.listen(cfg.porta, () => log.info("bridge_online", { porta: cfg.porta }));
}
