// Edge Function: dfe-manifestar
// Registra o evento de Manifestação do Destinatário na SEFAZ (Ambiente Nacional):
//  210200 Confirmação da Operação | 210210 Ciência da Emissão
//  210220 Desconhecimento da Operação | 210240 Operação não Realizada
// Assina o evento com o certificado A1 (e-CNPJ) da unidade (RSA-SHA1 / XMLDSig enveloped).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import forge from "npm:node-forge@1.3.1";
import { adminClient, autorizarUnidade, carregarCertificadoUnidade, soapPost, pick } from "../_shared/nfe-cert.ts";

const URL_EVENTO = "https://www1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tipo = "ciencia" | "confirmada" | "desconhecida" | "nao_realizada";

const CODIGO: Record<Tipo, string> = {
  confirmada: "210200", ciencia: "210210", desconhecida: "210220", nao_realizada: "210240",
};
const DESCRICAO: Record<Tipo, string> = {
  confirmada: "Confirmacao da Operacao", ciencia: "Ciencia da Emissao",
  desconhecida: "Desconhecimento da Operacao", nao_realizada: "Operacao nao Realizada",
};
const CONCLUSIVAS: Tipo[] = ["confirmada", "desconhecida", "nao_realizada"];
const EXIGE_JUSTIFICATIVA: Tipo[] = ["desconhecida", "nao_realizada"];

function escapar(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function dataEventoISO(): string {
  // Formato AAAA-MM-DDThh:mm:ss-03:00 (horário de Brasília)
  const agora = new Date(Date.now() - 3 * 3600 * 1000);
  return `${agora.toISOString().slice(0, 19)}-03:00`;
}

function assinarEvento(infEventoXml: string, idEvento: string, certBase64: string, privateKey: unknown): string {
  const md = forge.md.sha1.create();
  md.update(infEventoXml, "utf8");
  const digest = forge.util.encode64(md.digest().getBytes());

  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${idEvento}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digest}</DigestValue>` +
    `</Reference></SignedInfo>`;

  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfo, "utf8");
  const assinatura = forge.util.encode64((privateKey as any).sign(mdSig));

  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}` +
    `<SignatureValue>${assinatura}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const chave: string = String(body?.chave || "").replace(/\D/g, "");
    const tipo = String(body?.tipo || "") as Tipo;
    const justificativa = String(body?.justificativa || "").trim();

    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    if (chave.length !== 44) return json({ ok: false, motivo: "chave_invalida", mensagem: "Chave de acesso inválida." });
    if (!CODIGO[tipo]) return json({ ok: false, motivo: "tipo_invalido", mensagem: "Tipo de manifestação inválido." });
    if (EXIGE_JUSTIFICATIVA.includes(tipo) && (justificativa.length < 15 || justificativa.length > 255)) {
      return json({
        ok: false, motivo: "justificativa_invalida",
        mensagem: "Justificativa obrigatória entre 15 e 255 caracteres para esta manifestação.",
      });
    }

    const auth = await autorizarUnidade(req, unidadeId);
    if (!auth.ok) return json({ ok: false, motivo: auth.motivo, mensagem: auth.mensagem }, auth.status);

    const admin = adminClient();

    const { data: documento } = await admin
      .from("dfe_documentos").select("id, manifestacao, empresa_id")
      .eq("unidade_id", unidadeId).eq("chave", chave).maybeSingle();

    const atual = (documento?.manifestacao ?? null) as Tipo | null;
    if (atual && CONCLUSIVAS.includes(atual)) {
      return json({ ok: false, motivo: "manifestacao_conclusiva", mensagem: "A nota já possui manifestação conclusiva." });
    }
    if (atual === "ciencia" && tipo === "ciencia") {
      return json({ ok: false, motivo: "ja_manifestada", mensagem: "A Ciência da Emissão já foi registrada." });
    }

    const carga = await carregarCertificadoUnidade(admin, unidadeId);
    if (!carga.ok) return json({ ok: false, motivo: carga.motivo, mensagem: carga.mensagem });
    const { cert, cnpj } = carga;
    const empresaId = (documento?.empresa_id as string | null) ?? (carga.unidade.empresa_id as string | null) ?? null;

    // Sequência do evento: incrementa a cada tentativa registrada com sucesso do mesmo tipo
    const { count } = await admin
      .from("dfe_eventos").select("id", { count: "exact", head: true })
      .eq("unidade_id", unidadeId).eq("chave", chave).eq("tipo_evento", CODIGO[tipo]).eq("sucesso", true);
    const seq = Number(count ?? 0) + 1;

    const idEvento = `ID${CODIGO[tipo]}${chave}${String(seq).padStart(2, "0")}`;
    const detEvento =
      `<detEvento versao="1.00"><descEvento>${DESCRICAO[tipo]}</descEvento>` +
      (EXIGE_JUSTIFICATIVA.includes(tipo) ? `<xJust>${escapar(justificativa)}</xJust>` : "") +
      `</detEvento>`;

    const infEvento =
      `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${idEvento}">` +
      `<cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe>` +
      `<dhEvento>${dataEventoISO()}</dhEvento><tpEvento>${CODIGO[tipo]}</tpEvento>` +
      `<nSeqEvento>${seq}</nSeqEvento><verEvento>1.00</verEvento>${detEvento}</infEvento>`;

    const signature = assinarEvento(infEvento, idEvento, cert.certBase64, cert.privateKey);
    const eventoXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${infEvento}${signature}</evento>`;
    const envEvento = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${eventoXml}</envEvento>`;

    const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Body><nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg>${envEvento}</nfeDadosMsg></nfeRecepcaoEvento></soap12:Body></soap12:Envelope>`;

    const resp = await soapPost(URL_EVENTO, soap, cert);
    if (!resp.ok) {
      return json({
        ok: false, motivo: "sefaz_indisponivel", podeRepetir: true,
        mensagem: "Não foi possível falar com a SEFAZ agora. Tente novamente em alguns instantes.",
      });
    }

    const retEvento = resp.texto.match(/<retEvento[\s\S]*?<\/retEvento>/i)?.[0] ?? resp.texto;
    const cStat = pick(retEvento, "cStat");
    const xMotivo = pick(retEvento, "xMotivo");
    const protocolo = pick(retEvento, "nProt");
    const sucesso = ["135", "136", "573"].includes(String(cStat ?? ""));

    if (documento) {
      await admin.from("dfe_eventos").insert({
        documento_id: documento.id, unidade_id: unidadeId, empresa_id: empresaId, chave,
        tipo_evento: CODIGO[tipo], descricao: DESCRICAO[tipo], sequencia: seq,
        protocolo, cstat: cStat, xmotivo: xMotivo,
        justificativa: EXIGE_JUSTIFICATIVA.includes(tipo) ? justificativa : null,
        sucesso, criado_por: auth.userId, payload: { origem: "manifestacao_manual" },
      });
      if (sucesso) {
        await admin.from("dfe_documentos")
          .update({ manifestacao: tipo, manifestacao_em: new Date().toISOString() })
          .eq("id", documento.id);
      }
    }

    return json({
      ok: sucesso, cStat, xMotivo, protocolo, tipo, sequencia: seq,
      mensagem: sucesso
        ? `${DESCRICAO[tipo]} registrada na SEFAZ${protocolo ? ` (protocolo ${protocolo})` : ""}.`
        : `SEFAZ ${cStat ?? ""}: ${xMotivo ?? "evento não registrado"}`,
      motivo: sucesso ? undefined : "evento_rejeitado",
    });
  } catch (err) {
    console.error("[dfe-manifestar]", err);
    return json({ ok: false, motivo: "exception", mensagem: String((err as Error)?.message || err) });
  }
});
